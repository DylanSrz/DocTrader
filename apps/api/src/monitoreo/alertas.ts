import { formatearUsd, ZONA_HORARIA } from '@doctrader/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { DataSource } from 'typeorm';
import { AvisosService } from '../avisos/avisos.service.js';
import { fechaLegible } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { REDIS } from '../redis/redis.module.js';

/** Más de esto en una hora (en toda la plataforma) es un pico de ingresos fallidos. */
export const UMBRAL_INGRESOS_FALLIDOS = 50;

/** Contador de ingresos fallidos de una hora (UTC), que suma `AccesoService`. */
export const claveIngresosFallidos = (hora: Date) =>
  `alertas:ingresos-fallidos:${hora.toISOString().slice(0, 13)}`;

const hora = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: ZONA_HORARIA });

/**
 * Alertas a los dos admins (`docs/SEGURIDAD.md` §14). Los cambios de direcciones de depósito ya avisan solos; aquí
 * van los pagos que no se pudieron verificar en una hora, los picos de ingresos fallidos y los trabajos del worker
 * que fallan. Cada aviso lleva su clave, así no se repite.
 */
@Injectable()
export class Alertas {
  private readonly logger = new Logger(Alertas.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly avisos: AvisosService,
  ) {}

  /** Trabajo del worker, cada 15 minutos. */
  async revisar(ahora: Date = new Date()): Promise<{ pagos: number; ingresos: boolean }> {
    const atascados = (await this.fuente.query(
      `SELECT o.id, o.number, o.amount_usd_cents, o.currency, o.verification_status, u.full_name
         FROM payment_orders o JOIN users u ON u.id = o.user_id
        WHERE o.status = 'REPORTADA'
          AND o.verification_status IN ('SIN_VERIFICAR', 'ESPERANDO_CONFIRMACIONES', 'ERROR_PROVEEDOR')
          AND o.reported_at < $1::timestamptz - interval '1 hour'`,
      [ahora],
    )) as {
      id: string;
      number: string;
      amount_usd_cents: number;
      currency: string;
      verification_status: string;
      full_name: string;
    }[];
    const estados: Record<string, string> = {
      SIN_VERIFICAR: 'la transacción todavía no aparece',
      ESPERANDO_CONFIRMACIONES: 'esperando confirmaciones',
      ERROR_PROVEEDOR: 'los proveedores de la blockchain no responden',
    };

    // La hora que ya terminó: así el conteo está completo.
    const anterior = new Date(ahora.getTime() - 60 * 60_000);
    const total = Number((await this.redis.get(claveIngresosFallidos(anterior))) ?? 0);
    const pico = total > UMBRAL_INGRESOS_FALLIDOS;

    await this.fuente.transaction(async (m) => {
      for (const o of atascados) {
        await this.avisos.avisarAdmins(m, PLANTILLA.PAGO_ATASCADO, {
          clave: `pago-atascado:${o.id}`,
          datos: {
            orden: o.number,
            cliente: o.full_name,
            monto: `${formatearUsd(o.amount_usd_cents)} en ${o.currency}`,
            estado: estados[o.verification_status] ?? o.verification_status,
          },
        });
      }
      if (pico) {
        const desde = new Date(
          Date.UTC(
            anterior.getUTCFullYear(),
            anterior.getUTCMonth(),
            anterior.getUTCDate(),
            anterior.getUTCHours(),
          ),
        );
        await this.avisos.avisarAdmins(m, PLANTILLA.INGRESOS_FALLIDOS, {
          clave: `ingresos-fallidos:${desde.toISOString().slice(0, 13)}`,
          datos: {
            total: String(total),
            desde: hora.format(desde),
            hasta: hora.format(new Date(desde.getTime() + 60 * 60_000)),
          },
        });
      }
    });
    if (atascados.length || pico) {
      this.logger.warn(
        `Alertas: ${atascados.length} pagos sin verificar; ingresos fallidos ${total}`,
      );
    }
    return { pagos: atascados.length, ingresos: pico };
  }

  /** Un trabajo del worker falló: aviso a los admins, como máximo uno al día por trabajo. */
  async trabajoFallido(trabajo: string, error: Error, ahora: Date = new Date()): Promise<void> {
    await this.fuente.transaction((m) =>
      this.avisos.avisarAdmins(m, PLANTILLA.TRABAJO_FALLIDO, {
        clave: `trabajo-fallido:${trabajo}:${ahora.toISOString().slice(0, 10)}`,
        datos: { trabajo, fecha: fechaLegible(ahora), error: error.message.slice(0, 300) },
      }),
    );
  }
}
