import { type CodigoPlan, type Moneda, ZONA_HORARIA } from '@doctrader/shared';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

const Z = `'${ZONA_HORARIA}'`;
/** Inicio del día, del mes y del año en hora de Colombia, como `timestamptz`. */
const HOY = `(date_trunc('day', now() AT TIME ZONE ${Z}) AT TIME ZONE ${Z})`;
const MES = `(date_trunc('month', now() AT TIME ZONE ${Z}) AT TIME ZONE ${Z})`;
const MES_ANTERIOR = `(date_trunc('month', (now() AT TIME ZONE ${Z}) - interval '1 month') AT TIME ZONE ${Z})`;
const ANIO = `(date_trunc('year', now() AT TIME ZONE ${Z}) AT TIME ZONE ${Z})`;

/** Lo que se cuenta como venta: órdenes aprobadas, por lo que de verdad se cobró (`MODELO-DATOS` §3.4). */
const VENTAS = `FROM payment_orders o WHERE o.status = 'APROBADA'`;

interface FilaActividad {
  action: string;
  actor_role: string | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  cuenta: string | null;
  cliente: string | null;
}

/** Acciones que se muestran en "Actividad reciente". Los ingresos y la semilla no aportan. */
const ACCIONES_VISIBLES = [
  'usuario.registro',
  'cuenta.agregada',
  'orden.reportada',
  'pago.aprobado',
  'pago.rechazado',
  'cuenta.ver_contrasenas',
  'cuenta.conectada',
  'cuenta.desconectada',
  'cuenta.asignacion',
  'licencia.extendida',
  'licencia.suspendida',
  'licencia.reactivada',
  'licencias.exportadas',
  'cliente.ver_cedula',
  'direccion.agregada',
  'direccion.cancelada',
  'direccion.desactivada',
  'direccion.reactivada',
  'ajustes.precios',
  'ajustes.operacion',
  'ajustes.enlaces',
  'ajustes.myfxbook',
  'ajustes.aprobacion_automatica',
  'contenido.preguntas_guardadas',
  'contenido.legal_publicado',
];

/** Una frase por evento de la auditoría, en el tono del panel. */
export function fraseActividad(f: FilaActividad): string {
  const quien = f.actor ?? 'El sistema';
  const numero = typeof f.metadata.numero === 'string' ? f.metadata.numero : '';
  const cuenta = f.cuenta ? `la cuenta ${f.cuenta}` : 'una cuenta';
  const de = f.cliente ? ` de ${f.cliente}` : '';
  switch (f.action) {
    case 'usuario.registro':
      return `${quien} se registró.`;
    case 'cuenta.agregada':
      return `${quien} agregó ${cuenta}.`;
    case 'orden.reportada':
      return `${quien} reportó el pago de la orden ${numero}.`;
    case 'pago.aprobado':
      return f.metadata.modo === 'AUTO'
        ? `El pago ${numero} se aprobó solo: estaba verificado.`
        : `${quien} aprobó el pago ${numero}${f.metadata.forzado ? ' sin verificación completa' : ''}.`;
    case 'pago.rechazado':
      return `${quien} rechazó el pago ${numero}.`;
    case 'cuenta.ver_contrasenas':
      return `${quien} vio las contraseñas de ${cuenta}${de}.`;
    case 'cuenta.conectada':
      return `${quien} marcó como conectada ${cuenta}${de}.`;
    case 'cuenta.desconectada':
      return `${quien} marcó como desconectada ${cuenta}${de}.`;
    case 'cuenta.asignacion':
      return `${quien} ajustó el capital, el riesgo o las notas de ${cuenta}${de}.`;
    case 'licencia.extendida':
      return `${quien} sumó ${String(f.metadata.dias)} días a ${cuenta}${de}.`;
    case 'licencia.suspendida':
      return `${quien} suspendió la licencia de ${cuenta}${de}.`;
    case 'licencia.reactivada':
      return `${quien} reactivó la licencia de ${cuenta}${de}.`;
    case 'licencias.exportadas':
      return `${quien} exportó la lista de licencias.`;
    case 'cliente.ver_cedula':
      return `${quien} vio la cédula completa${de}.`;
    case 'direccion.agregada':
      return `${quien} agregó una dirección de depósito. Se activa en 24 horas.`;
    case 'direccion.cancelada':
      return `${quien} canceló una dirección de depósito en espera.`;
    case 'direccion.desactivada':
      return `${quien} desactivó una dirección de depósito.`;
    case 'direccion.reactivada':
      return `${quien} reactivó una dirección de depósito.`;
    case 'ajustes.precios':
      return `${quien} cambió los precios.`;
    case 'ajustes.operacion':
      return `${quien} cambió los días de gracia, la vigencia de la orden o las confirmaciones.`;
    case 'ajustes.enlaces':
      return `${quien} cambió los enlaces de la página.`;
    case 'ajustes.myfxbook':
      return `${quien} actualizó las cifras de Myfxbook.`;
    case 'ajustes.aprobacion_automatica':
      return `${quien} ${f.metadata.despues ? 'encendió' : 'apagó'} la aprobación automática.`;
    case 'contenido.preguntas_guardadas':
      return `${quien} editó las preguntas frecuentes.`;
    case 'contenido.legal_publicado':
      return `${quien} publicó una versión nueva de un texto legal.`;
    default:
      return `${quien}: ${f.action}.`;
  }
}

/** La portada del panel: lo pendiente, las ventas y la actividad reciente. */
@Injectable()
export class ResumenAdminService {
  constructor(@InjectDataSource() private readonly fuente: DataSource) {}

  async resumen() {
    const m = this.fuente.manager;
    const [[pendientes], [ventas], porMoneda, porDia, [cuentas], actividad, [mes]] =
      await Promise.all([
        m.query(
          `SELECT
             (SELECT count(*)::int FROM payment_orders WHERE status = 'REPORTADA') AS pagos,
             (SELECT count(*)::int FROM trading_accounts
               WHERE connection_status = 'POR_CONECTAR' AND deleted_at IS NULL) AS por_conectar,
             (SELECT count(*)::int FROM trading_accounts
               WHERE connection_status = 'POR_DESCONECTAR' AND deleted_at IS NULL) AS por_desconectar,
             (SELECT count(*)::int FROM licenses l JOIN trading_accounts t ON t.id = l.trading_account_id
               WHERE l.status = 'ACTIVA' AND l.ends_at <= now() + interval '7 days'
                 AND t.deleted_at IS NULL) AS vencen`,
        ) as Promise<
          { pagos: number; por_conectar: number; por_desconectar: number; vencen: number }[]
        >,
        m.query(
          `SELECT
             coalesce(sum(o.amount_usd_cents) FILTER (WHERE o.decided_at >= ${MES}), 0)::int AS mes,
             count(*) FILTER (WHERE o.decided_at >= ${MES})::int AS licencias_mes,
             coalesce(sum(o.amount_usd_cents) FILTER (WHERE o.decided_at >= ${HOY}), 0)::int AS hoy,
             coalesce(sum(o.amount_usd_cents)
               FILTER (WHERE o.decided_at >= ${MES_ANTERIOR} AND o.decided_at < ${MES}), 0)::int AS mes_anterior,
             coalesce(sum(o.amount_usd_cents) FILTER (WHERE o.decided_at >= ${ANIO}), 0)::int AS anio,
             count(*) FILTER (WHERE o.decided_at >= ${MES} AND o.type = 'NUEVA')::int AS nuevas,
             count(*) FILTER (WHERE o.decided_at >= ${MES}
               AND o.type IN ('RENOVACION', 'CAMBIO_DE_PLAN'))::int AS renovaciones
           ${VENTAS}`,
        ) as Promise<
          {
            mes: number;
            licencias_mes: number;
            hoy: number;
            mes_anterior: number;
            anio: number;
            nuevas: number;
            renovaciones: number;
          }[]
        >,
        m.query(
          `SELECT o.currency AS moneda, sum(o.amount_usd_cents)::int AS usd
             ${VENTAS} AND o.decided_at >= ${MES} GROUP BY o.currency ORDER BY usd DESC`,
        ) as Promise<{ moneda: Moneda; usd: number }[]>,
        m.query(
          `SELECT extract(day FROM o.decided_at AT TIME ZONE ${Z})::int AS dia, p.code AS plan,
                  count(*)::int AS n, sum(o.amount_usd_cents)::int AS usd
             FROM payment_orders o JOIN plans p ON p.id = o.plan_id
            WHERE o.status = 'APROBADA' AND o.decided_at >= ${MES}
            GROUP BY 1, 2 ORDER BY 1, 2`,
        ) as Promise<{ dia: number; plan: CodigoPlan; n: number; usd: number }[]>,
        m.query(
          `SELECT
             (SELECT count(*)::int FROM trading_accounts
               WHERE connection_status = 'CONECTADA' AND deleted_at IS NULL) AS conectadas,
             (SELECT count(*)::int FROM users WHERE role = 'CLIENT' AND status <> 'DELETED') AS clientes,
             (SELECT count(*)::int FROM users
               WHERE role = 'CLIENT' AND status <> 'DELETED' AND email_verified_at IS NOT NULL) AS verificados`,
        ) as Promise<{ conectadas: number; clientes: number; verificados: number }[]>,
        m.query(
          `SELECT a.action, a.actor_role, u.full_name AS actor, a.metadata, a.created_at,
                  t.account_number AS cuenta, c.full_name AS cliente
             FROM audit_log a
             LEFT JOIN users u ON u.id = a.actor_id
             LEFT JOIN licenses l ON a.target_type = 'license' AND l.id::text = a.target_id
             LEFT JOIN trading_accounts t ON t.id::text = CASE
               WHEN a.target_type = 'trading_account' THEN a.target_id
               WHEN a.target_type = 'license' THEN l.trading_account_id::text END
             LEFT JOIN users c ON c.id = coalesce(t.user_id,
               CASE WHEN a.target_type = 'user' THEN a.target_id::uuid END)
            WHERE a.action = ANY($1)
            ORDER BY a.id DESC LIMIT 8`,
          [ACCIONES_VISIBLES],
        ) as Promise<FilaActividad[]>,
        m.query(
          `SELECT extract(day FROM now() AT TIME ZONE ${Z})::int AS hoy,
                  extract(day FROM (date_trunc('month', now() AT TIME ZONE ${Z}) + interval '1 month - 1 day'))::int AS dias,
                  extract(month FROM now() AT TIME ZONE ${Z})::int AS mes,
                  extract(year FROM now() AT TIME ZONE ${Z})::int AS anio`,
        ) as Promise<{ hoy: number; dias: number; mes: number; anio: number }[]>,
      ]);
    return {
      pendientes: {
        pagos: pendientes!.pagos,
        porConectar: pendientes!.por_conectar,
        porDesconectar: pendientes!.por_desconectar,
        vencenEn7Dias: pendientes!.vencen,
      },
      ventas: {
        mes: { usdCentavos: ventas!.mes, licencias: ventas!.licencias_mes },
        hoyUsdCentavos: ventas!.hoy,
        mesAnteriorUsdCentavos: ventas!.mes_anterior,
        anioUsdCentavos: ventas!.anio,
        porMoneda: porMoneda.map((p) => ({ moneda: p.moneda, usdCentavos: p.usd })),
        porDia: porDia.map((d) => ({ dia: d.dia, plan: d.plan, n: d.n, usdCentavos: d.usd })),
        calendario: { hoy: mes!.hoy, dias: mes!.dias, mes: mes!.mes, anio: mes!.anio },
      },
      cuentas: {
        conectadas: cuentas!.conectadas,
        nuevasMes: ventas!.nuevas,
        renovacionesMes: ventas!.renovaciones,
        clientes: cuentas!.clientes,
        clientesVerificados: cuentas!.verificados,
      },
      actividad: actividad.map((a) => ({
        fecha: a.created_at,
        texto: fraseActividad(a),
        sistema: a.actor === null,
      })),
    };
  }
}
