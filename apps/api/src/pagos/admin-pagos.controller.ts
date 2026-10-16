import {
  describirReferencia,
  enlaceExplorador,
  ESTADO_ORDEN,
  deUnidadesBase,
  LIMITES_ADMIN,
  ROL,
  type Moneda,
} from '@doctrader/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { leerAjustes } from '../licencias/ajustes.js';
import { errorApi } from '../seguridad/errores.js';
import { Cliente, ConfirmacionReciente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { AprobacionPagos, type Decisor } from './aprobacion.service.js';
import { VerificacionPagos } from './verificacion-pagos.service.js';

export class AprobarDto {
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}

export class RechazarDto {
  @IsString()
  @Length(5, 500, { message: 'Escribe el motivo (entre 5 y 500 caracteres): le llega al cliente.' })
  motivo: string;
}

export class PagoManualDto {
  @IsString()
  @Length(LIMITES_ADMIN.motivo.minimo, LIMITES_ADMIN.motivo.maximo, {
    message: `Escribe cómo se verificó el pago (entre ${LIMITES_ADMIN.motivo.minimo} y ${LIMITES_ADMIN.motivo.maximo} caracteres).`,
  })
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;
}

export class AprobacionAutomaticaDto {
  @Type(() => Boolean)
  @IsBoolean()
  activa: boolean;
}

interface FilaOrden {
  id: string;
  number: string;
  type: string;
  status: string;
  verification_status: string | null;
  verification_detail: Record<string, unknown> | null;
  currency: Moneda;
  network: 'TRON' | 'BITCOIN';
  amount_base_units: string;
  received_base_units: string | null;
  amount_usd_cents: number;
  deposit_address: string;
  tx_hash: string | null;
  confirmations: number | null;
  created_at: Date;
  expires_at: Date;
  reported_at: Date | null;
  decided_at: Date | null;
  rejection_reason: string | null;
  approval_mode: string | null;
  sender_addresses: string[] | null;
  cliente: string;
  correo: string;
  cuenta: string;
  broker: string;
  plan: string;
  codigo_plan: string;
}

const CONSULTA = `
  SELECT o.id, o.number, o.type, o.status, o.verification_status, o.verification_detail, o.currency, o.network,
         o.amount_base_units, o.received_base_units, o.amount_usd_cents, o.deposit_address, o.tx_hash,
         o.confirmations, o.created_at, o.expires_at, o.reported_at, o.decided_at, o.rejection_reason,
         o.approval_mode, o.sender_addresses, u.full_name AS cliente, u.email AS correo, t.account_number AS cuenta,
         t.broker, p.name AS plan, p.code AS codigo_plan
    FROM payment_orders o
    JOIN users u ON u.id = o.user_id
    JOIN trading_accounts t ON t.id = o.trading_account_id
    JOIN plans p ON p.id = o.plan_id`;

/** Pagos desde el panel de administración: revisar, aprobar, rechazar y la aprobación automática. */
@Roles(ROL.ADMIN)
@Controller('admin/pagos')
export class AdminPagosController {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly aprobacion: AprobacionPagos,
    private readonly verificacion: VerificacionPagos,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar() {
    const m = this.fuente.manager;
    const [ajustes, porRevisar, expiradas, decididas] = await Promise.all([
      leerAjustes(m),
      m.query(`${CONSULTA} WHERE o.status = 'REPORTADA' ORDER BY o.reported_at ASC`) as Promise<
        FilaOrden[]
      >,
      m.query(
        `${CONSULTA} WHERE o.status = 'EXPIRADA' AND o.created_at > now() - interval '7 days'
          ORDER BY o.created_at DESC LIMIT 50`,
      ) as Promise<FilaOrden[]>,
      m.query(
        `${CONSULTA} WHERE o.status IN ('APROBADA', 'RECHAZADA') AND o.decided_at > now() - interval '7 days'
          ORDER BY o.decided_at DESC LIMIT 50`,
      ) as Promise<FilaOrden[]>,
    ]);
    const vista = (o: FilaOrden) => {
      const detalle = o.verification_detail ?? {};
      return {
        numero: o.number,
        tipo: o.type,
        estado: o.status,
        verificacion: o.verification_status,
        cliente: { nombre: o.cliente, correo: o.correo },
        cuenta: { numero: o.cuenta, broker: o.broker },
        plan: { codigo: o.codigo_plan, nombre: o.plan },
        moneda: o.currency,
        red: o.network,
        monto: deUnidadesBase(BigInt(o.amount_base_units), o.currency),
        recibido: o.received_base_units
          ? deUnidadesBase(BigInt(o.received_base_units), o.currency)
          : null,
        montoUsdCentavos: o.amount_usd_cents,
        direccion: o.deposit_address,
        hash: o.tx_hash ? describirReferencia(o.tx_hash) : null,
        enlaceExplorador: o.tx_hash ? enlaceExplorador(o.network, o.tx_hash) : null,
        confirmaciones: o.confirmations,
        confirmacionesNecesarias: ajustes.confirmaciones[o.network],
        chequeos: (detalle.chequeos as unknown[] | undefined) ?? [],
        nota: (detalle.nota as string | null | undefined) ?? null,
        error: (detalle.error as string | undefined) ?? null,
        proveedor: (detalle.proveedor as string | undefined) ?? null,
        revisadaEn: (detalle.revisadaEn as string | undefined) ?? null,
        creadaEn: o.created_at,
        expiraEn: o.expires_at,
        reportadaEn: o.reported_at,
        decididaEn: o.decided_at,
        modo: o.approval_mode,
        motivoRechazo: o.rejection_reason,
      };
    };
    return {
      aprobacionAutomatica: ajustes.aprobacionAutomatica,
      porRevisar: porRevisar.map(vista),
      expiradas: expiradas.map(vista),
      decididas: decididas.map(vista),
    };
  }

  @Post(':numero/aprobar')
  @HttpCode(HttpStatus.OK)
  async aprobar(
    @Param('numero') numero: string,
    @Body() dto: AprobarDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.aprobacion.aprobar(numero, this.decisor(sesion, cliente), dto.forzar === true);
    return { ok: true };
  }

  @Post(':numero/rechazar')
  @HttpCode(HttpStatus.OK)
  async rechazar(
    @Param('numero') numero: string,
    @Body() dto: RechazarDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.aprobacion.rechazar(numero, dto.motivo.trim(), this.decisor(sesion, cliente));
    return { ok: true };
  }

  /**
   * Registrar a mano el pago de una orden pendiente o vencida (por ejemplo, venció mientras el cliente pagaba) y
   * aprobarlo. Acción delicada: exige el segundo factor reciente.
   */
  @Post(':numero/manual')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async manual(
    @Param('numero') numero: string,
    @Body() dto: PagoManualDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.aprobacion.registrarManual(
      numero,
      { motivo: dto.motivo.trim(), referencia: dto.referencia },
      this.decisor(sesion, cliente),
    );
    return { ok: true };
  }

  /** Volver a mirar la blockchain ahora, sin esperar al worker. */
  @Post(':numero/verificar')
  @HttpCode(HttpStatus.OK)
  async verificar(@Param('numero') numero: string) {
    const [orden] = (await this.fuente.query(
      `SELECT id, status FROM payment_orders WHERE number = $1`,
      [numero],
    )) as { id: string; status: string }[];
    if (!orden) throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa orden.');
    if (orden.status !== ESTADO_ORDEN.REPORTADA) {
      throw errorApi(HttpStatus.CONFLICT, 'NO_REVISABLE', 'Esta orden ya no está por revisar.');
    }
    await this.verificacion.verificar(orden.id);
    return { ok: true };
  }

  /**
   * Encender la aprobación automática es una acción delicada (`docs/SEGURIDAD.md` §3): exige confirmar con el
   * segundo factor. Apagarla no.
   */
  @Put('aprobacion-automatica')
  async aprobacionAutomatica(
    @Body() dto: AprobacionAutomaticaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    if (dto.activa && sesion.confirmadaHasta <= Date.now()) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        'CONFIRMACION_REQUERIDA',
        'Por seguridad, confirma que eres tú antes de continuar.',
      );
    }
    await this.fuente.transaction(async (m) => {
      const antes = (await leerAjustes(m)).aprobacionAutomatica;
      await m.query(
        `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('auto_approve_payments', $1::jsonb, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [JSON.stringify(dto.activa), sesion.usuarioId],
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'ajustes.aprobacion_automatica',
          targetType: 'setting',
          targetId: 'auto_approve_payments',
          metadata: { antes, despues: dto.activa },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    return { activa: dto.activa };
  }

  private decisor(sesion: SesionActiva, cliente: ContextoCliente): Decisor & { tipo: 'ADMIN' } {
    return { tipo: 'ADMIN', id: sesion.usuarioId, ip: cliente.ip, userAgent: cliente.userAgent };
  }
}
