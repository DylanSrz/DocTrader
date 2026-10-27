import {
  ESPERA_CAMBIO_DIRECCION_HORAS,
  formatearUsd,
  interpretarReferencia,
  nombreReservado,
  periodoDeComision,
  ROL,
} from '@doctrader/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { direccionTronValida } from '../pagos/tron.js';
import { errorApi, errorDeCampos } from '../seguridad/errores.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import {
  asegurarPerfil,
  duenoDelCodigo,
  leerAjustesReferidos,
  referidorParaRegistro,
  rutaReferidos,
  viaParaReferir,
} from './reglas.js';

const HORA_MS = 60 * 60_000;

/** Lo que ve de un referido quien lo invitó: nombre de pila e inicial, nunca correos, documentos ni cuentas. */
const nombreParaReferidor = (nombre: string, estado: string) =>
  estado === 'DELETED' ? 'Cliente eliminado' : nombreReservado(nombre);

const nombrePeriodo = (inicio: string, fin: string) => {
  const formato = (dia: string) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(`${dia}T12:00:00Z`),
    );
  return `${formato(inicio)} al ${formato(fin)} de ${fin.slice(0, 4)}`;
};

/**
 * Programa de referidos (`docs/PLAN-TRABAJO.md`, etapa 11):
 * - el referidor ve su enlace, sus referidos, sus comisiones y sus pagos, y registra su dirección de cobro;
 * - los admins ven los pagos por enviar, los marcan enviados con el hash, habilitan referidores y corrigen errores;
 * - el worker cierra cada quincena por referidor (`liquidar`), con el mínimo y la espera tras cambiar la dirección.
 * La comisión de cada venta se fija al aprobarla (`pagos/aprobacion.service.ts`).
 */
@Injectable()
export class ReferidosService {
  private readonly logger = new Logger(ReferidosService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
    private readonly limites: LimitesService,
  ) {}

  // ── Público y referidor ─────────────────────────────────────────────────────────────────────────────

  /** "Te invitó: Patricia O." en el registro. `null` si el código no sirve hoy (no existe o el dueño no refiere). */
  async invitacion(codigo: string, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.codigoReferidoPorIp, cliente.ip);
    const dueno = await referidorParaRegistro(this.fuente.manager, codigo);
    if (!dueno) {
      throw errorApi(
        HttpStatus.NOT_FOUND,
        'CODIGO_INVALIDO',
        'Ese código de invitación no existe.',
      );
    }
    return { nombre: nombreReservado(dueno.nombre) };
  }

  async vistaPropia(sesion: SesionActiva, ahora: Date = new Date()) {
    const m = this.fuente.manager;
    const id = sesion.usuarioId;
    const [ajustes, via] = await Promise.all([leerAjustesReferidos(m), viaParaReferir(m, id)]);
    let perfil = await this.perfil(m, id);
    if (!perfil && via && ajustes.activo) {
      await asegurarPerfil(m, id);
      perfil = await this.perfil(m, id);
    }
    const programa = {
      activo: ajustes.activo,
      porcentajeBp: ajustes.porcentajeBp,
      segundaLineaBp: ajustes.segundaLineaBp,
      minimoPagoUsdCents: ajustes.minimoPagoUsdCents,
      esperaHoras: ESPERA_CAMBIO_DIRECCION_HORAS,
    };
    if (!perfil) return { programa, puedeReferir: via !== null, via, perfil: null };

    const actual = periodoDeComision(ahora);
    const [referidos, comisiones, pagos, [sumas]] = await Promise.all([
      m.query(
        `WITH red AS (
           SELECT u.id, u.full_name, u.status, u.referred_at, 1 AS nivel, NULL::text AS via
             FROM users u WHERE u.referred_by = $1
           UNION ALL
           SELECT n.id, n.full_name, n.status, n.referred_at, 2, i.full_name
             FROM users n JOIN users i ON i.id = n.referred_by
            WHERE i.referred_by = $1 AND n.id <> $1
         )
         SELECT r.full_name, r.status, r.referred_at, r.nivel, r.via,
                EXISTS (SELECT 1 FROM licenses l WHERE l.user_id = r.id AND l.status IN ('ACTIVA', 'EN_GRACIA'))
                  AS con_licencia,
                EXISTS (SELECT 1 FROM payment_orders o WHERE o.user_id = r.id AND o.status = 'APROBADA')
                  AS compro
           FROM red r
          ORDER BY r.nivel, r.referred_at DESC NULLS LAST LIMIT 400`,
        [id],
      ) as Promise<
        {
          full_name: string;
          status: string;
          referred_at: Date | null;
          nivel: number;
          via: string | null;
          con_licencia: boolean;
          compro: boolean;
        }[]
      >,
      m.query(
        `SELECT c.earned_at, c.level, c.bp, c.usd_cents, u.full_name, u.status AS estado_usuario,
                i.full_name AS via, p.name AS plan, o.amount_usd_cents, rp.status AS pago
           FROM referral_commissions c
           JOIN payment_orders o ON o.id = c.payment_order_id
           JOIN users u ON u.id = o.user_id
           LEFT JOIN users i ON i.id = u.referred_by AND c.level = 2
           JOIN plans p ON p.id = o.plan_id
           LEFT JOIN referral_payouts rp ON rp.id = c.payout_id
          WHERE c.referrer_id = $1
          ORDER BY c.earned_at DESC LIMIT 100`,
        [id],
      ) as Promise<
        {
          earned_at: Date;
          level: number;
          bp: number;
          usd_cents: number;
          full_name: string;
          estado_usuario: string;
          via: string | null;
          plan: string;
          amount_usd_cents: number;
          pago: 'CERRADA' | 'PAGADA' | null;
        }[]
      >,
      m.query(
        `SELECT id, to_char(period_start, 'YYYY-MM-DD') AS inicio, to_char(period_end, 'YYYY-MM-DD') AS fin,
                sales_count, commission_usd_cents, usdt_address, status, paid_at, tx_hash
           FROM referral_payouts WHERE referrer_id = $1 ORDER BY period_start DESC LIMIT 48`,
        [id],
      ) as Promise<
        {
          id: string;
          inicio: string;
          fin: string;
          sales_count: number;
          commission_usd_cents: string;
          usdt_address: string;
          status: 'CERRADA' | 'PAGADA';
          paid_at: Date | null;
          tx_hash: string | null;
        }[]
      >,
      m.query(
        `SELECT
           coalesce(sum(c.usd_cents) FILTER (WHERE c.payout_id IS NULL AND c.earned_at >= $2), 0)::bigint
             AS periodo,
           coalesce(sum(c.usd_cents) FILTER (WHERE c.payout_id IS NULL), 0)::bigint AS acumulado,
           count(DISTINCT o.user_id) FILTER (WHERE c.level = 1)::int AS compradores,
           count(DISTINCT o.user_id) FILTER (WHERE c.level = 2)::int AS compradores_segunda
           FROM referral_commissions c JOIN payment_orders o ON o.id = c.payment_order_id
          WHERE c.referrer_id = $1`,
        [id, actual.desde],
      ) as Promise<
        { periodo: string; acumulado: string; compradores: number; compradores_segunda: number }[]
      >,
    ]);

    const enEsperaHasta =
      perfil.address_changed_at &&
      perfil.address_changed_at.getTime() + ESPERA_CAMBIO_DIRECCION_HORAS * HORA_MS >
        ahora.getTime()
        ? new Date(perfil.address_changed_at.getTime() + ESPERA_CAMBIO_DIRECCION_HORAS * HORA_MS)
        : null;
    // Quien eliminó su cuenta sale de la red visible (sus compras pasadas siguen en las comisiones).
    const vivos = referidos.filter((r) => r.status !== 'DELETED');
    const sumaPagos = (estado: 'CERRADA' | 'PAGADA') =>
      pagos
        .filter((p) => p.status === estado)
        .reduce((suma, p) => suma + Number(p.commission_usd_cents), 0);
    return {
      programa,
      puedeReferir: via !== null,
      via,
      perfil: {
        codigo: perfil.code,
        direccion: perfil.usdt_address,
        direccionCambiadaEn: perfil.address_changed_at,
        enEsperaHasta,
      },
      cifras: {
        registrados: vivos.filter((r) => r.nivel === 1).length,
        compradores: sumas?.compradores ?? 0,
        registradosSegunda: vivos.filter((r) => r.nivel === 2).length,
        compradoresSegunda: sumas?.compradores_segunda ?? 0,
        periodo: {
          inicio: actual.inicio,
          fin: actual.fin,
          comisionUsdCents: Number(sumas?.periodo ?? 0),
        },
        // Ganado y todavía sin liquidar: se paga al cerrar la quincena si llega al mínimo.
        acumuladoUsdCents: Number(sumas?.acumulado ?? 0),
        porPagarUsdCents: sumaPagos('CERRADA'),
        pagadoUsdCents: sumaPagos('PAGADA'),
      },
      referidos: vivos.map((r) => ({
        nombre: nombreReservado(r.full_name),
        nivel: r.nivel,
        via: r.via ? nombreReservado(r.via) : null,
        registradoEn: r.referred_at,
        estado: r.con_licencia ? 'CON_LICENCIA' : r.compro ? 'VENCIDA' : 'REGISTRADO',
      })),
      comisiones: comisiones.map((c) => ({
        fecha: c.earned_at,
        nivel: c.level,
        referido: nombreParaReferidor(c.full_name, c.estado_usuario),
        via: c.via ? nombreReservado(c.via) : null,
        plan: c.plan,
        montoUsdCents: c.amount_usd_cents,
        porcentajeBp: c.bp,
        comisionUsdCents: c.usd_cents,
        estado: c.pago ?? 'ACUMULADA',
      })),
      pagos: pagos.map((p) => ({
        id: p.id,
        inicio: p.inicio,
        fin: p.fin,
        ventas: p.sales_count,
        comisionUsdCents: Number(p.commission_usd_cents),
        direccion: p.usdt_address,
        estado: p.status,
        enviadoEn: p.paid_at,
        hash: p.tx_hash,
      })),
    };
  }

  /**
   * Cambia la dirección de cobro (USDT, Tron). Exige confirmar la identidad (controlador), avisa por correo y deja el
   * próximo pago en espera 48 horas: si alguien roba la cuenta, el dueño alcanza a reaccionar antes de un envío.
   */
  async cambiarDireccion(direccion: string, sesion: SesionActiva, cliente: ContextoCliente) {
    const limpia = direccion.trim();
    if (!direccionTronValida(limpia)) {
      throw errorDeCampos({
        direccion:
          'Esa no es una dirección de Tron válida. Cópiala de tu billetera: empieza por T y tiene 34 caracteres.',
      });
    }
    await this.limites.exigir(LIMITES.direccionCobroPorUsuario, sesion.usuarioId);
    await this.fuente.transaction(async (m) => {
      const [perfil] = (await m.query(
        `SELECT r.usdt_address, u.email, u.full_name, u.role
           FROM referral_profiles r JOIN users u ON u.id = r.user_id
          WHERE r.user_id = $1 FOR UPDATE OF r`,
        [sesion.usuarioId],
      )) as { usdt_address: string | null; email: string; full_name: string; role: string }[];
      if (!perfil) {
        throw errorApi(
          HttpStatus.FORBIDDEN,
          'SIN_PROGRAMA',
          'Para cobrar comisiones necesitas una licencia activa.',
        );
      }
      if (perfil.usdt_address === limpia) return;
      // La primera dirección no espera: no hay una anterior que alguien pueda estar desviando.
      await m.query(
        `UPDATE referral_profiles
            SET usdt_address = $2, address_changed_at = CASE WHEN usdt_address IS NULL THEN NULL ELSE now() END,
                updated_at = now()
          WHERE user_id = $1`,
        [sesion.usuarioId, limpia],
      );
      await this.avisos.encolar(m, {
        usuarioId: sesion.usuarioId,
        correo: perfil.email,
        plantilla: PLANTILLA.REFERIDO_DIRECCION_CAMBIADA,
        datos: {
          nombre: primerNombre(perfil.full_name),
          direccion: limpia,
          horas: perfil.usdt_address ? String(ESPERA_CAMBIO_DIRECCION_HORAS) : '0',
          ruta: rutaReferidos(perfil.role),
        },
      });
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'referido.direccion_cambiada',
          targetType: 'user',
          targetId: sesion.usuarioId,
          metadata: { anterior: perfil.usdt_address, nueva: limpia },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────────────────────────────

  async vistaAdmin() {
    const m = this.fuente.manager;
    const [ajustes, porEnviar, enviados, referidores, [acumulado]] = await Promise.all([
      leerAjustesReferidos(m),
      m.query(
        `SELECT rp.id, to_char(rp.period_start, 'YYYY-MM-DD') AS inicio, to_char(rp.period_end, 'YYYY-MM-DD') AS fin,
                rp.sales_count, rp.commission_usd_cents, rp.usdt_address, rp.created_at,
                u.id AS referidor_id, u.full_name, u.email
           FROM referral_payouts rp JOIN users u ON u.id = rp.referrer_id
          WHERE rp.status = 'CERRADA' ORDER BY rp.created_at`,
      ) as Promise<
        {
          id: string;
          inicio: string;
          fin: string;
          sales_count: number;
          commission_usd_cents: string;
          usdt_address: string;
          created_at: Date;
          referidor_id: string;
          full_name: string;
          email: string;
        }[]
      >,
      m.query(
        `SELECT rp.id, to_char(rp.period_start, 'YYYY-MM-DD') AS inicio, to_char(rp.period_end, 'YYYY-MM-DD') AS fin,
                rp.commission_usd_cents, rp.usdt_address, rp.paid_at, rp.tx_hash,
                u.full_name, a.full_name AS enviado_por
           FROM referral_payouts rp JOIN users u ON u.id = rp.referrer_id LEFT JOIN users a ON a.id = rp.paid_by
          WHERE rp.status = 'PAGADA' ORDER BY rp.paid_at DESC LIMIT 50`,
      ) as Promise<
        {
          id: string;
          inicio: string;
          fin: string;
          commission_usd_cents: string;
          usdt_address: string;
          paid_at: Date;
          tx_hash: string | null;
          full_name: string;
          enviado_por: string | null;
        }[]
      >,
      // Quienes tienen referidos o están habilitados, de más a menos comisión ganada.
      m.query(
        `SELECT u.id, u.full_name, u.email, u.role, r.code, r.enabled_by_admin, r.enabled_at,
                r.usdt_address IS NOT NULL AS con_direccion,
                EXISTS (SELECT 1 FROM partner_profiles p WHERE p.user_id = u.id) AS es_socio,
                (SELECT count(*)::int FROM users x WHERE x.referred_by = u.id AND x.status <> 'DELETED') AS registrados,
                (SELECT count(*)::int FROM users x JOIN users i ON i.id = x.referred_by
                  WHERE i.referred_by = u.id AND x.id <> u.id AND x.status <> 'DELETED') AS registrados_segunda,
                (SELECT count(DISTINCT o.user_id)::int FROM referral_commissions c
                   JOIN payment_orders o ON o.id = c.payment_order_id
                  WHERE c.referrer_id = u.id AND c.level = 1) AS compradores,
                (SELECT count(DISTINCT o.user_id)::int FROM referral_commissions c
                   JOIN payment_orders o ON o.id = c.payment_order_id
                  WHERE c.referrer_id = u.id AND c.level = 2) AS compradores_segunda,
                (SELECT coalesce(sum(c.usd_cents), 0)::bigint FROM referral_commissions c
                  WHERE c.referrer_id = u.id) AS ganado,
                (SELECT coalesce(sum(c.usd_cents), 0)::bigint FROM referral_commissions c
                  WHERE c.referrer_id = u.id AND c.payout_id IS NULL) AS acumulado
           FROM referral_profiles r JOIN users u ON u.id = r.user_id
          WHERE r.enabled_by_admin OR EXISTS (SELECT 1 FROM users x WHERE x.referred_by = u.id)
          ORDER BY ganado DESC, registrados DESC, u.full_name LIMIT 200`,
      ) as Promise<
        {
          id: string;
          full_name: string;
          email: string;
          role: string;
          code: string;
          es_socio: boolean;
          enabled_by_admin: boolean;
          enabled_at: Date | null;
          con_direccion: boolean;
          registrados: number;
          registrados_segunda: number;
          compradores: number;
          compradores_segunda: number;
          ganado: string;
          acumulado: string;
        }[]
      >,
      m.query(
        `SELECT coalesce(sum(usd_cents), 0)::bigint AS total FROM referral_commissions WHERE payout_id IS NULL`,
      ) as Promise<{ total: string }[]>,
    ]);
    return {
      ajustes,
      acumuladoUsdCents: Number(acumulado?.total ?? 0),
      porEnviar: porEnviar.map((p) => ({
        id: p.id,
        inicio: p.inicio,
        fin: p.fin,
        ventas: p.sales_count,
        comisionUsdCents: Number(p.commission_usd_cents),
        direccion: p.usdt_address,
        cerradoEn: p.created_at,
        referidor: { id: p.referidor_id, nombre: p.full_name, correo: p.email },
      })),
      enviados: enviados.map((p) => ({
        id: p.id,
        inicio: p.inicio,
        fin: p.fin,
        comisionUsdCents: Number(p.commission_usd_cents),
        direccion: p.usdt_address,
        enviadoEn: p.paid_at,
        hash: p.tx_hash,
        referidor: p.full_name,
        enviadoPor: p.enviado_por,
      })),
      referidores: referidores.map((r) => ({
        id: r.id,
        nombre: r.full_name,
        correo: r.email,
        esAdmin: r.role === ROL.ADMIN,
        esSocio: r.es_socio,
        codigo: r.code,
        habilitado: r.enabled_by_admin,
        habilitadoEn: r.enabled_at,
        conDireccion: r.con_direccion,
        registrados: r.registrados,
        compradores: r.compradores,
        registradosSegunda: r.registrados_segunda,
        compradoresSegunda: r.compradores_segunda,
        ganadoUsdCents: Number(r.ganado),
        acumuladoUsdCents: Number(r.acumulado),
      })),
    };
  }

  async cambiarAjustes(
    ajustes: {
      porcentajeBp: number;
      segundaLineaBp: number;
      minimoPagoUsdCents: number;
      activo: boolean;
    },
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.fuente.transaction(async (m) => {
      const anteriores = await leerAjustesReferidos(m);
      for (const [clave, valor] of [
        ['referrals.percentage_bp', ajustes.porcentajeBp],
        ['referrals.level2_bp', ajustes.segundaLineaBp],
        ['referrals.min_payout_usd_cents', ajustes.minimoPagoUsdCents],
        ['referrals.enabled', ajustes.activo],
      ] as const) {
        await m.query(
          `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [clave, JSON.stringify(valor), sesion.usuarioId],
        );
      }
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'referido.ajustes_cambiados',
          targetType: 'setting',
          metadata: { anteriores, nuevos: ajustes },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /** Marca enviado un pago de referidos, con el hash de la transacción o el número de la transferencia de Binance. */
  async marcarEnviado(
    id: string,
    hashEscrito: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    const hash = interpretarReferencia(hashEscrito);
    if (!hash) {
      throw errorDeCampos({
        hash: 'Escribe el hash de la transacción (64 letras y números) o el número de la transferencia de Binance.',
      });
    }
    await this.fuente.transaction(async (m) => {
      const [[fila]] = (await m.query(
        `UPDATE referral_payouts
            SET status = 'PAGADA', paid_at = now(), paid_by = $2, tx_hash = $3, updated_at = now()
          WHERE id = $1 AND status = 'CERRADA'
          RETURNING id, referrer_id, to_char(period_start, 'YYYY-MM-DD') AS inicio,
                    to_char(period_end, 'YYYY-MM-DD') AS fin, commission_usd_cents, usdt_address`,
        [id, sesion.usuarioId, hash],
      )) as [
        {
          id: string;
          referrer_id: string;
          inicio: string;
          fin: string;
          commission_usd_cents: string;
          usdt_address: string;
        }[],
        number,
      ];
      if (!fila) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'NO_PAGABLE',
          'Ese pago ya está marcado como enviado o no existe. Recarga la página.',
        );
      }
      const [referidor] = (await m.query(
        `SELECT email, full_name, role, status FROM users WHERE id = $1`,
        [fila.referrer_id],
      )) as { email: string; full_name: string; role: string; status: string }[];
      if (referidor && referidor.status !== 'DELETED') {
        await this.avisos.encolar(m, {
          usuarioId: fila.referrer_id,
          correo: referidor.email,
          plantilla: PLANTILLA.REFERIDO_PAGO_ENVIADO,
          datos: {
            nombre: primerNombre(referidor.full_name),
            monto: formatearUsd(Number(fila.commission_usd_cents)),
            direccion: fila.usdt_address,
            periodo: nombrePeriodo(fila.inicio, fila.fin),
            hash,
            ruta: rutaReferidos(referidor.role),
          },
          clave: `referido-pago:${fila.id}`,
        });
      }
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'referido.pago_enviado',
          targetType: 'referral_payout',
          targetId: fila.id,
          metadata: {
            referidorId: fila.referrer_id,
            usdCentavos: Number(fila.commission_usd_cents),
            direccion: fila.usdt_address,
            hash,
          },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /** Lo del programa en la ficha de un cliente: quién lo invitó y si un admin lo habilitó para referir. */
  async fichaCliente(id: string) {
    const m = this.fuente.manager;
    const [usuario] = (await m.query(
      `SELECT u.role, u.referred_at, i.id AS invito_id, i.full_name AS invito_nombre, i.email AS invito_correo,
              ri.code AS invito_codigo, r.code, r.enabled_by_admin, r.enabled_at, r.usdt_address
         FROM users u
         LEFT JOIN users i ON i.id = u.referred_by
         LEFT JOIN referral_profiles ri ON ri.user_id = i.id
         LEFT JOIN referral_profiles r ON r.user_id = u.id
        WHERE u.id = $1`,
      [id],
    )) as {
      role: string;
      referred_at: Date | null;
      invito_id: string | null;
      invito_nombre: string | null;
      invito_correo: string | null;
      invito_codigo: string | null;
      code: string | null;
      enabled_by_admin: boolean | null;
      enabled_at: Date | null;
      usdt_address: string | null;
    }[];
    if (!usuario || usuario.role !== ROL.CLIENTE) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese cliente.');
    }
    return {
      referidoPor: usuario.invito_id
        ? {
            id: usuario.invito_id,
            nombre: usuario.invito_nombre,
            correo: usuario.invito_correo,
            codigo: usuario.invito_codigo,
            desde: usuario.referred_at,
          }
        : null,
      puedeReferir: (await viaParaReferir(m, id)) !== null,
      perfil: usuario.code
        ? {
            codigo: usuario.code,
            habilitado: usuario.enabled_by_admin === true,
            habilitadoEn: usuario.enabled_at,
            direccion: usuario.usdt_address,
          }
        : null,
    };
  }

  /** Habilita (o deshabilita) a un cliente para referir aunque no tenga licencia activa. */
  async habilitar(id: string, habilitado: boolean, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      await this.clienteVigente(m, id);
      if (habilitado) await asegurarPerfil(m, id);
      const [, cambiadas] = (await m.query(
        `UPDATE referral_profiles
            SET enabled_by_admin = $2,
                enabled_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
                enabled_at = CASE WHEN $2 THEN now() ELSE NULL END,
                updated_at = now()
          WHERE user_id = $1 AND enabled_by_admin <> $2`,
        [id, habilitado, sesion.usuarioId],
      )) as [unknown, number];
      if (!cambiadas) return;
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: habilitado ? 'referido.habilitado' : 'referido.deshabilitado',
          targetType: 'user',
          targetId: id,
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /**
   * Corrige quién invitó a un cliente (o lo quita). Solo cambia las ventas que se aprueben después: las comisiones
   * ya fijadas se anulan una por una (`anularComision`).
   */
  async corregirReferidor(
    id: string,
    codigo: string | null,
    motivo: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.fuente.transaction(async (m) => {
      const usuario = await this.clienteVigente(m, id);
      const nuevo = codigo ? await duenoDelCodigo(m, codigo) : null;
      if (codigo && !nuevo)
        throw errorDeCampos({ codigo: 'No hay ningún referidor con ese código.' });
      if (nuevo?.id === id)
        throw errorDeCampos({ codigo: 'Un cliente no puede referirse a sí mismo.' });
      if ((nuevo?.id ?? null) === usuario.referred_by) return;
      if (nuevo) {
        // La red no puede tener ciclos: el nuevo referidor no puede estar debajo de este cliente.
        const [ciclo] = (await m.query(
          `WITH RECURSIVE arriba AS (
             SELECT id, referred_by, 1 AS paso FROM users WHERE id = $1
             UNION ALL
             SELECT u.id, u.referred_by, a.paso + 1 FROM users u JOIN arriba a ON u.id = a.referred_by
              WHERE a.paso < 100
           )
           SELECT 1 FROM arriba WHERE id = $2 LIMIT 1`,
          [nuevo.id, id],
        )) as unknown[];
        if (ciclo) {
          throw errorDeCampos({
            codigo: 'Ese referidor está en la red de este cliente: se formaría un ciclo.',
          });
        }
      }
      await m.query(
        `UPDATE users SET referred_by = $2, referred_at = CASE WHEN $2::uuid IS NULL THEN NULL ELSE now() END,
                updated_at = now()
          WHERE id = $1`,
        [id, nuevo?.id ?? null],
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'referido.corregido',
          targetType: 'user',
          targetId: id,
          metadata: { anterior: usuario.referred_by, nuevo: nuevo?.id ?? null, motivo },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /** Quita la comisión de una venta que todavía no se liquidó (autorreferido, fraude, error). */
  async anularComision(
    numero: string,
    nivel: 1 | 2 | null,
    motivo: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.fuente.transaction(async (m) => {
      const [orden] = (await m.query(`SELECT id FROM payment_orders WHERE number = $1 FOR UPDATE`, [
        numero,
      ])) as { id: string }[];
      const comisiones = orden
        ? ((await m.query(
            `SELECT id, referrer_id, level, usd_cents, payout_id FROM referral_commissions
              WHERE payment_order_id = $1 AND ($2::int IS NULL OR level = $2)`,
            [orden.id, nivel],
          )) as {
            id: string;
            referrer_id: string;
            level: number;
            usd_cents: number;
            payout_id: string | null;
          }[])
        : [];
      if (!orden || comisiones.length === 0) {
        throw errorApi(
          HttpStatus.NOT_FOUND,
          'SIN_COMISION',
          nivel
            ? `Esa orden no tiene comisión de referido de ${nivel === 1 ? 'primera' : 'segunda'} línea.`
            : 'Esa orden no tiene comisión de referido.',
        );
      }
      const anulables = comisiones.filter((c) => !c.payout_id);
      if (anulables.length === 0) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'YA_LIQUIDADA',
          'Esa comisión ya se liquidó en un pago de quincena: no se puede anular.',
        );
      }
      await m.query(`DELETE FROM referral_commissions WHERE id = ANY($1::uuid[])`, [
        anulables.map((c) => c.id),
      ]);
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'referido.comision_anulada',
          targetType: 'payment_order',
          targetId: orden.id,
          metadata: {
            numero,
            motivo,
            anuladas: anulables.map((c) => ({
              nivel: c.level,
              referidorId: c.referrer_id,
              usdCentavos: c.usd_cents,
            })),
          },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  private async clienteVigente(m: EntityManager, id: string) {
    const [usuario] = (await m.query(
      `SELECT role, status, referred_by FROM users WHERE id = $1 FOR UPDATE`,
      [id],
    )) as { role: string; status: string; referred_by: string | null }[];
    if (!usuario || usuario.role !== ROL.CLIENTE || usuario.status === 'DELETED') {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese cliente.');
    }
    return usuario;
  }

  private async perfil(m: EntityManager, id: string) {
    const [perfil] = (await m.query(
      `SELECT code, usdt_address, address_changed_at FROM referral_profiles WHERE user_id = $1`,
      [id],
    )) as { code: string; usdt_address: string | null; address_changed_at: Date | null }[];
    return perfil ?? null;
  }

  // ── Worker ──────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Trabajo del worker (cada hora, con la liquidación del socio): por cada referidor con comisiones de quincenas ya
   * terminadas y sin liquidar, crea su pago si:
   * - lo acumulado llega al mínimo (si no, se suma a la quincena siguiente);
   * - tiene dirección de cobro, y no la cambió en las últimas 48 horas.
   * El pago copia la dirección: si después la cambia, el admin envía a la que quedó en el pago.
   */
  async liquidar(ahora: Date = new Date()): Promise<number> {
    const corte = periodoDeComision(ahora).desde;
    const referidores = (await this.fuente.query(
      `SELECT DISTINCT referrer_id FROM referral_commissions WHERE payout_id IS NULL AND earned_at < $1`,
      [corte],
    )) as { referrer_id: string }[];
    const creados: { id: string; usdCents: number }[] = [];
    for (const { referrer_id } of referidores) {
      const pago = await this.cerrar(referrer_id, ahora);
      if (pago) creados.push(pago);
    }
    if (creados.length) {
      const total = creados.reduce((suma, p) => suma + p.usdCents, 0);
      await this.fuente.transaction((m) =>
        this.avisos.avisarAdmins(m, PLANTILLA.REFERIDOS_POR_PAGAR, {
          clave: `referidos-por-pagar:${creados[0]!.id}`,
          datos: {
            pagos: creados.length === 1 ? '1 pago' : `${creados.length} pagos`,
            total: formatearUsd(total),
          },
        }),
      );
    }
    return creados.length;
  }

  private async cerrar(
    referidorId: string,
    ahora: Date,
  ): Promise<{ id: string; usdCents: number } | null> {
    const corte = periodoDeComision(ahora).desde;
    return this.fuente.transaction(async (m) => {
      const [perfil] = (await m.query(
        `SELECT usdt_address, address_changed_at FROM referral_profiles WHERE user_id = $1 FOR UPDATE`,
        [referidorId],
      )) as { usdt_address: string | null; address_changed_at: Date | null }[];
      if (!perfil?.usdt_address) return null;
      if (
        perfil.address_changed_at &&
        ahora.getTime() - perfil.address_changed_at.getTime() <
          ESPERA_CAMBIO_DIRECCION_HORAS * HORA_MS
      ) {
        return null;
      }
      const ajustes = await leerAjustesReferidos(m);
      const [pendiente] = (await m.query(
        `SELECT min(earned_at) AS desde, max(earned_at) AS hasta, coalesce(sum(usd_cents), 0)::bigint AS total
           FROM referral_commissions
          WHERE referrer_id = $1 AND payout_id IS NULL AND earned_at < $2`,
        [referidorId, corte],
      )) as { desde: Date | null; hasta: Date | null; total: string }[];
      const total = Number(pendiente?.total ?? 0);
      if (!pendiente?.desde || total === 0 || total < ajustes.minimoPagoUsdCents) return null;

      // De la quincena de la venta más vieja a la de la más reciente (todas ya terminadas).
      const inicio = periodoDeComision(pendiente.desde).inicio;
      const fin = periodoDeComision(pendiente.hasta!).fin;
      const [pago] = (await m.query(
        `INSERT INTO referral_payouts (referrer_id, period_start, period_end, usdt_address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (referrer_id, period_start) DO NOTHING
         RETURNING id`,
        [referidorId, inicio, fin, perfil.usdt_address],
      )) as { id: string }[];
      if (!pago) {
        this.logger.warn(`Pago de referidos repetido para ${referidorId} desde ${inicio}`);
        return null;
      }
      await m.query(
        `UPDATE referral_commissions SET payout_id = $1
          WHERE referrer_id = $2 AND payout_id IS NULL AND earned_at < $3`,
        [pago.id, referidorId, corte],
      );
      const [suma] = (await m.query(
        `SELECT count(*)::int AS ventas, coalesce(sum(o.amount_usd_cents), 0)::bigint AS bruto,
                coalesce(sum(c.usd_cents), 0)::bigint AS comision
           FROM referral_commissions c JOIN payment_orders o ON o.id = c.payment_order_id
          WHERE c.payout_id = $1`,
        [pago.id],
      )) as { ventas: number; bruto: string; comision: string }[];
      await m.query(
        `UPDATE referral_payouts
            SET sales_count = $2, gross_usd_cents = $3, commission_usd_cents = $4, updated_at = now()
          WHERE id = $1`,
        [pago.id, suma!.ventas, suma!.bruto, suma!.comision],
      );
      this.logger.log(
        `Pago de referidos ${pago.id}: ${suma!.ventas} ventas, ${formatearUsd(Number(suma!.comision))}`,
      );
      return { id: pago.id, usdCents: Number(suma!.comision) };
    });
  }
}
