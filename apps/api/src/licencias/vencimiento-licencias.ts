import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { fechaSinHora } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';

/** Recordatorios antes del vencimiento, en días. Solo se envía el del tramo en el que está la licencia. */
export const DIAS_RECORDATORIO = [1, 3, 7] as const;
const DIA_MS = 24 * 60 * 60_000;

interface FilaLicencia {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  account_number: string;
  broker: string;
  plan: string;
  ends_at: Date;
  grace_ends_at: Date;
  conexion_antes?: string;
}

const DATOS_LICENCIA = `
  l.id, l.user_id, u.email, u.full_name, t.account_number, t.broker, p.name AS plan, l.ends_at, l.grace_ends_at`;

/**
 * Trabajos del worker sobre las fechas de las licencias (`docs/MODELO-DATOS.md` §5):
 * - Cada 5 minutos: una licencia activa que llegó a su vencimiento entra en gracia, y una en gracia que llegó al fin
 *   de la gracia vence. Al vencer, una cuenta conectada pasa a "por desconectar" y una que nunca se conectó deja de
 *   estar "por conectar". Cada cambio le avisa al cliente, y "por desconectar" también a los admins.
 * - Cada hora: los recordatorios de 7, 3 y 1 día antes del vencimiento.
 * Cada correo lleva una clave con la fecha de vencimiento: no se repite, y una renovación empieza un ciclo nuevo.
 */
@Injectable()
export class VencimientoLicencias {
  private readonly logger = new Logger(VencimientoLicencias.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
  ) {}

  async actualizar(): Promise<{ enGracia: number; vencidas: number }> {
    return this.fuente.transaction(async (m) => {
      const enGracia = (await m.query(
        `WITH cambiadas AS (
           UPDATE licenses SET status = 'EN_GRACIA', updated_at = now()
            WHERE status = 'ACTIVA' AND ends_at <= now() RETURNING id
         )
         SELECT ${DATOS_LICENCIA}
           FROM cambiadas c JOIN licenses l ON l.id = c.id
           JOIN users u ON u.id = l.user_id
           JOIN trading_accounts t ON t.id = l.trading_account_id
           JOIN plans p ON p.id = l.plan_id`,
      )) as FilaLicencia[];
      const vencidas = (await m.query(
        `WITH cambiadas AS (
           UPDATE licenses SET status = 'VENCIDA', updated_at = now()
            WHERE status = 'EN_GRACIA' AND grace_ends_at <= now() RETURNING id
         )
         SELECT ${DATOS_LICENCIA}, t.connection_status AS conexion_antes
           FROM cambiadas c JOIN licenses l ON l.id = c.id
           JOIN users u ON u.id = l.user_id
           JOIN trading_accounts t ON t.id = l.trading_account_id
           JOIN plans p ON p.id = l.plan_id`,
      )) as FilaLicencia[];
      if (vencidas.length > 0) {
        await m.query(
          `UPDATE trading_accounts SET connection_status = CASE connection_status
              WHEN 'CONECTADA' THEN 'POR_DESCONECTAR'
              WHEN 'POR_CONECTAR' THEN 'SIN_LICENCIA'
              ELSE connection_status END,
             updated_at = now()
            WHERE id IN (SELECT trading_account_id FROM licenses WHERE id = ANY($1::uuid[]))`,
          [vencidas.map((v) => v.id)],
        );
      }

      for (const l of enGracia) {
        await this.avisos.encolar(m, {
          usuarioId: l.user_id,
          correo: l.email,
          plantilla: PLANTILLA.LICENCIA_EN_GRACIA,
          datos: {
            nombre: primerNombre(l.full_name),
            cuenta: l.account_number,
            gracia: fechaSinHora(l.grace_ends_at),
          },
          clave: `en-gracia:${l.id}:${l.ends_at.toISOString()}`,
        });
      }
      for (const l of vencidas) {
        const conectada = l.conexion_antes === 'CONECTADA';
        await this.avisos.encolar(m, {
          usuarioId: l.user_id,
          correo: l.email,
          plantilla: PLANTILLA.LICENCIA_VENCIDA,
          datos: {
            nombre: primerNombre(l.full_name),
            cuenta: l.account_number,
            conectada: conectada ? 'si' : 'no',
          },
          clave: `vencida:${l.id}:${l.grace_ends_at.toISOString()}`,
        });
        if (conectada) {
          await this.avisos.avisarAdmins(m, PLANTILLA.CUENTA_POR_DESCONECTAR, {
            clave: `por-desconectar:${l.id}:${l.grace_ends_at.toISOString()}`,
            datos: { cuenta: l.account_number, cliente: l.full_name, broker: l.broker },
          });
        }
      }

      if (enGracia.length || vencidas.length) {
        this.logger.log(`Licencias en gracia: ${enGracia.length}; vencidas: ${vencidas.length}`);
      }
      return { enGracia: enGracia.length, vencidas: vencidas.length };
    });
  }

  /**
   * Recordatorios de vencimiento a las licencias activas que vencen en los próximos 7 días. No se recuerda a quien ya
   * reportó el pago de la renovación (está en revisión).
   */
  async recordar(ahora: Date = new Date()): Promise<number> {
    return this.fuente.transaction(async (m) => {
      const filas = (await m.query(
        `SELECT ${DATOS_LICENCIA}
           FROM licenses l
           JOIN users u ON u.id = l.user_id
           JOIN trading_accounts t ON t.id = l.trading_account_id
           JOIN plans p ON p.id = l.plan_id
          WHERE l.status = 'ACTIVA' AND l.ends_at > $1 AND l.ends_at <= $2
            AND t.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM payment_orders o WHERE o.license_id = l.id AND o.status = 'REPORTADA'
            )`,
        [ahora, new Date(ahora.getTime() + 7 * DIA_MS)],
      )) as FilaLicencia[];
      for (const l of filas) await this.recordarUna(m, l, ahora);
      return filas.length;
    });
  }

  private async recordarUna(m: EntityManager, l: FilaLicencia, ahora: Date) {
    const faltan = l.ends_at.getTime() - ahora.getTime();
    const dias = DIAS_RECORDATORIO.find((d) => faltan <= d * DIA_MS);
    if (!dias) return;
    await this.avisos.encolar(m, {
      usuarioId: l.user_id,
      correo: l.email,
      plantilla: PLANTILLA.LICENCIA_POR_VENCER,
      datos: {
        nombre: primerNombre(l.full_name),
        dias: String(dias),
        cuenta: l.account_number,
        plan: l.plan.toLowerCase(),
        vence: fechaSinHora(l.ends_at),
      },
      clave: `vence-${dias}d:${l.id}:${l.ends_at.toISOString()}`,
    });
  }
}
