import {
  formatearPorcentaje,
  formatearUsd,
  periodoDeComision,
  periodosCerrados,
  type PeriodoComision,
} from '@doctrader/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { fechaLegible } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { errorApi } from '../seguridad/errores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';

interface FilaSocio {
  id: string;
  user_id: string;
  commission_bp: number;
  full_name: string;
}

interface Totales {
  ventas: number;
  bruto: number;
  comision: number;
}

const TOTALES_SQL = `count(*)::int AS ventas,
  coalesce(sum(amount_usd_cents), 0)::bigint AS bruto,
  coalesce(sum(commission_usd_cents), 0)::bigint AS comision`;

function totales(fila: { ventas: number; bruto: string; comision: string } | undefined): Totales {
  return {
    ventas: fila?.ventas ?? 0,
    bruto: Number(fila?.bruto ?? 0),
    comision: Number(fila?.comision ?? 0),
  };
}

const nombrePeriodo = (p: { inicio: string; fin: string }) => {
  const [anio, mes, desde] = p.inicio.split('-');
  const hasta = p.fin.split('-')[2];
  const nombreMes = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${anio}-${mes}-01T12:00:00Z`),
  );
  return `${Number(desde)} al ${Number(hasta)} de ${nombreMes} de ${anio}`;
};

/**
 * El socio desarrollador (`docs/CONTEXTO.md`): su porcentaje sobre las ventas brutas aprobadas, las quincenas
 * liquidadas y su pago. El porcentaje de cada venta se fija al aprobarla (`payment_orders.commission_bp`), así un
 * cambio solo aplica a las ventas siguientes.
 */
@Injectable()
export class SocioService {
  private readonly logger = new Logger(SocioService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async socio(m: EntityManager, bloquear = false): Promise<FilaSocio | null> {
    const [fila] = (await m.query(
      `SELECT p.id, p.user_id, p.commission_bp, u.full_name
         FROM partner_profiles p JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at LIMIT 1 ${bloquear ? 'FOR UPDATE OF p' : ''}`,
    )) as FilaSocio[];
    return fila ?? null;
  }

  async vista(sesion: SesionActiva, ahora: Date = new Date()) {
    const m = this.fuente.manager;
    const socio = await this.socio(m);
    if (!socio) return { socio: null };
    const actual = periodoDeComision(ahora);
    const [enCurso, liquidaciones, cambios] = await Promise.all([
      m.query(
        `SELECT ${TOTALES_SQL} FROM payment_orders
          WHERE status = 'APROBADA' AND commission_payout_id IS NULL AND decided_at >= $1 AND decided_at < $2`,
        [actual.desde, actual.hasta],
      ) as Promise<{ ventas: number; bruto: string; comision: string }[]>,
      m.query(
        `SELECT c.id, to_char(c.period_start, 'YYYY-MM-DD') AS inicio, to_char(c.period_end, 'YYYY-MM-DD') AS fin,
                c.sales_count, c.gross_usd_cents, c.commission_usd_cents, c.status, c.paid_at,
                c.payment_reference, u.full_name AS pagada_por
           FROM commission_payouts c LEFT JOIN users u ON u.id = c.paid_by
          WHERE c.partner_id = $1
          ORDER BY c.period_start DESC LIMIT 48`,
        [socio.id],
      ) as Promise<
        {
          id: string;
          inicio: string;
          fin: string;
          sales_count: number;
          gross_usd_cents: string;
          commission_usd_cents: string;
          status: 'CERRADA' | 'PAGADA';
          paid_at: Date | null;
          payment_reference: string | null;
          pagada_por: string | null;
        }[]
      >,
      m.query(
        `SELECT c.old_bp, c.new_bp, c.created_at, u.full_name AS quien
           FROM commission_rate_changes c LEFT JOIN users u ON u.id = c.changed_by
          WHERE c.partner_id = $1 ORDER BY c.created_at DESC LIMIT 50`,
        [socio.id],
      ) as Promise<
        { old_bp: number | null; new_bp: number; created_at: Date; quien: string | null }[]
      >,
    ]);
    const t = totales(enCurso[0]);
    return {
      socio: {
        nombre: socio.full_name,
        porcentajeBp: socio.commission_bp,
        // Solo el socio cambia su porcentaje, desde su propio perfil (diseño de la propuesta 2).
        esElSocio: socio.user_id === sesion.usuarioId,
      },
      actual: {
        inicio: actual.inicio,
        fin: actual.fin,
        ventas: t.ventas,
        brutoUsdCents: t.bruto,
        comisionUsdCents: t.comision,
      },
      porPagarUsdCents: liquidaciones
        .filter((l) => l.status === 'CERRADA')
        .reduce((suma, l) => suma + Number(l.commission_usd_cents), 0),
      liquidaciones: liquidaciones.map((l) => ({
        id: l.id,
        inicio: l.inicio,
        fin: l.fin,
        ventas: l.sales_count,
        brutoUsdCents: Number(l.gross_usd_cents),
        comisionUsdCents: Number(l.commission_usd_cents),
        estado: l.status,
        pagadaEn: l.paid_at,
        pagadaPor: l.pagada_por,
        referencia: l.payment_reference,
      })),
      cambios: cambios.map((c) => ({
        fecha: c.created_at,
        anteriorBp: c.old_bp,
        nuevoBp: c.new_bp,
        quien: c.quien,
      })),
    };
  }

  async cambiarPorcentaje(porcentajeBp: number, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const socio = await this.socio(m, true);
      if (!socio) throw errorApi(HttpStatus.NOT_FOUND, 'SIN_SOCIO', 'No hay un socio configurado.');
      if (socio.user_id !== sesion.usuarioId) {
        throw errorApi(
          HttpStatus.FORBIDDEN,
          'SOLO_EL_SOCIO',
          'Solo el socio puede cambiar su porcentaje, desde su perfil.',
        );
      }
      if (socio.commission_bp === porcentajeBp) return;
      await m.query(
        `UPDATE partner_profiles SET commission_bp = $2, updated_at = now() WHERE id = $1`,
        [socio.id, porcentajeBp],
      );
      await m.query(
        `INSERT INTO commission_rate_changes (partner_id, old_bp, new_bp, changed_by) VALUES ($1, $2, $3, $4)`,
        [socio.id, socio.commission_bp, porcentajeBp, sesion.usuarioId],
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'socio.comision_cambiada',
          targetType: 'partner_profile',
          targetId: socio.id,
          metadata: { anteriorBp: socio.commission_bp, nuevoBp: porcentajeBp },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      await this.avisos.avisarAdmins(m, PLANTILLA.COMISION_CAMBIADA, {
        clave: `comision:${socio.id}:${Date.now()}`,
        datos: {
          quien: primerNombre(socio.full_name),
          anterior: formatearPorcentaje(socio.commission_bp),
          nuevo: formatearPorcentaje(porcentajeBp),
          fecha: fechaLegible(),
        },
      });
    });
  }

  async marcarPagada(
    id: string,
    referencia: string | undefined,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.fuente.transaction(async (m) => {
      // En Postgres, un UPDATE con RETURNING devuelve [filas, cantidad].
      const [[fila]] = (await m.query(
        `UPDATE commission_payouts
            SET status = 'PAGADA', paid_at = now(), paid_by = $2, payment_reference = $3, updated_at = now()
          WHERE id = $1 AND status = 'CERRADA'
          RETURNING id, to_char(period_start, 'YYYY-MM-DD') AS inicio, commission_usd_cents`,
        [id, sesion.usuarioId, referencia?.trim() || null],
      )) as [{ id: string; inicio: string; commission_usd_cents: string }[], number];
      if (!fila) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_PAGABLE',
          'Esa liquidación ya está pagada o no existe. Recarga la página.',
        );
      }
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'socio.liquidacion_pagada',
          targetType: 'commission_payout',
          targetId: fila.id,
          metadata: {
            periodo: fila.inicio,
            comisionUsdCentavos: Number(fila.commission_usd_cents),
            referencia: referencia?.trim() || null,
          },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /**
   * Trabajo del worker (cada hora): cierra las quincenas terminadas que tienen ventas sin liquidar. Cada quincena
   * queda en una fila con sus totales y sus órdenes ligadas; si el worker estuvo apagado, se ponen al día todas.
   */
  async liquidar(ahora: Date = new Date()): Promise<number> {
    const [primera] = (await this.fuente.query(
      `SELECT min(decided_at) AS desde FROM payment_orders
        WHERE status = 'APROBADA' AND commission_payout_id IS NULL AND decided_at < $1`,
      [periodoDeComision(ahora).desde],
    )) as { desde: Date | null }[];
    if (!primera?.desde) return 0;
    let cerradas = 0;
    for (const periodo of periodosCerrados(primera.desde, ahora)) {
      if (await this.cerrar(periodo)) cerradas++;
    }
    return cerradas;
  }

  private async cerrar(periodo: PeriodoComision): Promise<boolean> {
    return this.fuente.transaction(async (m) => {
      const socio = await this.socio(m, true);
      if (!socio) return false;
      const [pendiente] = (await m.query(
        `SELECT count(*)::int AS n FROM payment_orders
          WHERE status = 'APROBADA' AND commission_payout_id IS NULL AND decided_at >= $1 AND decided_at < $2`,
        [periodo.desde, periodo.hasta],
      )) as { n: number }[];
      if (!pendiente?.n) return false;

      const [liquidacion] = (await m.query(
        `INSERT INTO commission_payouts (partner_id, period_start, period_end)
         VALUES ($1, $2, $3)
         ON CONFLICT (partner_id, period_start) DO UPDATE SET updated_at = now()
         RETURNING id`,
        [socio.id, periodo.inicio, periodo.fin],
      )) as { id: string }[];
      await m.query(
        `UPDATE payment_orders SET commission_payout_id = $1
          WHERE status = 'APROBADA' AND commission_payout_id IS NULL AND decided_at >= $2 AND decided_at < $3`,
        [liquidacion!.id, periodo.desde, periodo.hasta],
      );
      const [suma] = (await m.query(
        `SELECT ${TOTALES_SQL} FROM payment_orders WHERE commission_payout_id = $1`,
        [liquidacion!.id],
      )) as { ventas: number; bruto: string; comision: string }[];
      const t = totales(suma);
      await m.query(
        `UPDATE commission_payouts
            SET sales_count = $2, gross_usd_cents = $3, commission_usd_cents = $4, updated_at = now()
          WHERE id = $1`,
        [liquidacion!.id, t.ventas, t.bruto, t.comision],
      );
      await this.avisos.avisarAdmins(m, PLANTILLA.COMISION_LIQUIDADA, {
        clave: `liquidacion:${liquidacion!.id}:${t.ventas}`,
        datos: {
          periodo: nombrePeriodo(periodo),
          bruto: formatearUsd(t.bruto),
          ventas: t.ventas === 1 ? '1 venta' : `${t.ventas} ventas`,
          comision: formatearUsd(t.comision),
          pagar: t.comision > 0 ? 'si' : 'no',
        },
      });
      this.logger.log(
        `Quincena ${periodo.inicio} liquidada: ${t.ventas} ventas, comisión ${formatearUsd(t.comision)}`,
      );
      return true;
    });
  }
}
