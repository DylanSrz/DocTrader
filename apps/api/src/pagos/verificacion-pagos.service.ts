import {
  ESTADO_ORDEN,
  ESTADO_VERIFICACION,
  esTransferenciaBinance,
  formatearUsd,
  type Moneda,
} from '@doctrader/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, In } from 'typeorm';
import { AvisosService } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { PaymentOrder, Plan, User } from '../database/entidades/index.js';
import { leerAjustes } from '../licencias/ajustes.js';
import { AprobacionPagos } from './aprobacion.service.js';
import { LectorBlockchain, SinLlaveBinance } from './lector-blockchain.service.js';
import { ErrorProveedor } from './lectura.js';
import { evaluar, type ResultadoVerificacion } from './verificacion.js';

/** Estados en los que la verificación vuelve a mirar la blockchain. Los demás ya no cambian con el tiempo. */
const POR_REVISAR = [
  ESTADO_VERIFICACION.SIN_VERIFICAR,
  ESTADO_VERIFICACION.ESPERANDO_CONFIRMACIONES,
  ESTADO_VERIFICACION.ERROR_PROVEEDOR,
];

/**
 * Verifica los pagos reportados en la blockchain y guarda los cinco chequeos en la orden. Lo corre el worker cada
 * minuto, y un admin puede pedirlo a mano. Con la aprobación automática encendida, aprueba los verificados.
 */
@Injectable()
export class VerificacionPagos {
  private readonly logger = new Logger(VerificacionPagos.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly lector: LectorBlockchain,
    private readonly aprobacion: AprobacionPagos,
    private readonly avisos: AvisosService,
  ) {}

  /** Todas las órdenes reportadas que esperan algo de la blockchain (y las verificadas, si se aprueban solas). */
  async verificarPendientes(): Promise<void> {
    const ajustes = await leerAjustes(this.fuente.manager);
    const estados = ajustes.aprobacionAutomatica
      ? [...POR_REVISAR, ESTADO_VERIFICACION.VERIFICADA]
      : POR_REVISAR;
    const ordenes = await this.fuente.getRepository(PaymentOrder).find({
      where: { status: ESTADO_ORDEN.REPORTADA, verificationStatus: In(estados) },
      order: { reportedAt: 'ASC' },
      take: 50,
    });
    for (const orden of ordenes) {
      try {
        await this.verificar(orden.id);
      } catch (error) {
        this.logger.error(`No se pudo verificar ${orden.number}: ${(error as Error).message}`);
      }
    }
  }

  async verificar(ordenId: string): Promise<void> {
    const orden = await this.fuente.getRepository(PaymentOrder).findOneBy({ id: ordenId });
    if (!orden || orden.status !== ESTADO_ORDEN.REPORTADA || !orden.txHash) return;
    const ajustes = await leerAjustes(this.fuente.manager);

    if (orden.verificationStatus !== ESTADO_VERIFICACION.VERIFICADA) {
      let lectura;
      try {
        lectura = await this.lector.leer(orden.network, orden.txHash, {
          moneda: orden.currency as Moneda,
          creadaEn: orden.createdAt,
        });
      } catch (error) {
        if (!(error instanceof ErrorProveedor)) throw error;
        if (error instanceof SinLlaveBinance) {
          // Sin llave no hay forma de verificarlo: se avisa una sola vez a los admins para que lo revisen a mano.
          await this.avisarRevision(orden, {
            estado: ESTADO_VERIFICACION.ERROR_PROVEEDOR,
            chequeos: [],
            nota: error.message,
            recibido: null,
            confirmaciones: null,
            hora: null,
            bloque: null,
            remitentes: [],
          });
        }
        // Sin proveedores no se sabe nada nuevo: se conserva lo último que se supo y se reintenta.
        await this.fuente.query(
          `UPDATE payment_orders
              SET verification_status = CASE WHEN verification_status = 'SIN_VERIFICAR'
                    THEN 'ERROR_PROVEEDOR' ELSE verification_status END,
                  verification_detail = coalesce(verification_detail, '{}'::jsonb) || $2::jsonb,
                  updated_at = now()
            WHERE id = $1 AND status = 'REPORTADA'`,
          [
            orden.id,
            JSON.stringify({
              error: error.message,
              nota: error instanceof SinLlaveBinance ? error.message : null,
              revisadaEn: new Date().toISOString(),
            }),
          ],
        );
        return;
      }

      const resultado = evaluar(
        {
          direccion: orden.depositAddress,
          moneda: orden.currency as Moneda,
          red: orden.network,
          unidades: BigInt(orden.amountBaseUnits),
          creadaEn: orden.createdAt,
          reportadaEn: orden.reportedAt ?? orden.createdAt,
          interna: esTransferenciaBinance(orden.txHash),
        },
        lectura.lectura,
        ajustes.confirmaciones[orden.network],
      );
      await this.fuente.query(
        `UPDATE payment_orders
            SET verification_status = $2, received_base_units = $3, confirmations = $4, tx_time = $5,
                block_height = $6, sender_addresses = $7::jsonb, verification_detail = $8::jsonb,
                updated_at = now()
          WHERE id = $1 AND status = 'REPORTADA'`,
        [
          orden.id,
          resultado.estado,
          resultado.recibido?.toString() ?? null,
          resultado.confirmaciones,
          resultado.hora,
          resultado.bloque,
          JSON.stringify(resultado.remitentes),
          JSON.stringify({
            proveedor: lectura.proveedor,
            revisadaEn: new Date().toISOString(),
            chequeos: resultado.chequeos,
            nota: resultado.nota,
          }),
        ],
      );
      const terminal =
        resultado.estado === ESTADO_VERIFICACION.MONTO_INCOMPLETO ||
        resultado.estado === ESTADO_VERIFICACION.NO_COINCIDE ||
        (resultado.estado === ESTADO_VERIFICACION.VERIFICADA && !ajustes.aprobacionAutomatica);
      if (terminal) await this.avisarRevision(orden, resultado);
      if (resultado.estado !== ESTADO_VERIFICACION.VERIFICADA) return;
    }

    if (ajustes.aprobacionAutomatica) {
      await this.aprobacion.aprobar(orden.number, { tipo: 'SISTEMA' }).catch((error: unknown) => {
        this.logger.error(`No se pudo aprobar solo ${orden.number}: ${(error as Error).message}`);
      });
    }
  }

  /** Avisa a los admins que un pago espera su decisión: verificado, o con un problema que hay que mirar a mano. */
  private async avisarRevision(orden: PaymentOrder, resultado: ResultadoVerificacion) {
    await this.fuente.transaction(async (m) => {
      const [cliente, plan] = await Promise.all([
        m.getRepository(User).findOneByOrFail({ id: orden.userId }),
        m.getRepository(Plan).findOneByOrFail({ id: orden.planId }),
      ]);
      const fallas = resultado.chequeos.filter((c) => c.estado === 'FALLA').map((c) => c.texto);
      await this.avisos.avisarAdmins(m, PLANTILLA.PAGO_POR_REVISAR, {
        clave: `pago-por-revisar:${orden.id}:${resultado.estado}`,
        datos: {
          estado: resultado.estado,
          orden: orden.number,
          cliente: cliente.fullName,
          plan: plan.name.toLowerCase(),
          monto: `${formatearUsd(orden.amountUsdCents)} en ${orden.currency}`,
          motivo: (resultado.nota ?? fallas.join('; ')) || 'no coincide con la orden',
        },
      });
    });
  }
}
