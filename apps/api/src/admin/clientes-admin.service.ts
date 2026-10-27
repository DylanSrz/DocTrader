import {
  type EstadoConexion,
  type EstadoLicencia,
  type EstadoOrden,
  type EstadoTicket,
  ESTADO_USUARIO,
  type EstadoUsuario,
  type FiltroClientes,
  FILTROS_CLIENTES,
  type Moneda,
  ROL,
  type TemaTicket,
  type TipoOrden,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { errorApi } from '../seguridad/errores.js';
import {
  type ContextoCliente,
  type SesionActiva,
  SesionesService,
} from '../sesiones/sesiones.service.js';

/** Condición SQL de cada filtro de la lista de clientes (sobre la fila de `base`, ver `listar`). */
const CONDICION: Record<FiltroClientes, string> = {
  todos: 'true',
  sin_cuenta: 'cuentas = 0',
  con_licencia: 'vigentes > 0',
  vencidos: 'vigentes = 0 AND alguna_vencida',
  referidores: 'referidor',
  suspendidos: `status = 'SUSPENDED'`,
};

const MAXIMO_FILAS = 500;

/** Todos los clientes registrados, con lo justo para la lista. Los eliminados no aparecen: ya no tienen datos. */
const CONSULTA_BASE = (busqueda: string) => `
  WITH base AS (
    SELECT u.id, u.full_name, u.email, u.phone_e164, u.status, u.created_at,
           u.email_verified_at IS NOT NULL AS verificado,
           r.full_name AS invitado_por,
           (SELECT count(*)::int FROM trading_accounts t WHERE t.user_id = u.id AND t.deleted_at IS NULL) AS cuentas,
           (SELECT count(*)::int FROM licenses l
              JOIN trading_accounts t ON t.id = l.trading_account_id AND t.deleted_at IS NULL
             WHERE l.user_id = u.id AND l.status IN ('ACTIVA', 'EN_GRACIA')) AS vigentes,
           EXISTS (SELECT 1 FROM licenses l WHERE l.user_id = u.id AND l.status = 'VENCIDA') AS alguna_vencida,
           coalesce(rp.enabled_by_admin, false) AS habilitado,
           coalesce(rp.enabled_by_admin, false)
             OR EXISTS (SELECT 1 FROM users x WHERE x.referred_by = u.id) AS referidor
      FROM users u
      LEFT JOIN users r ON r.id = u.referred_by
      LEFT JOIN referral_profiles rp ON rp.user_id = u.id
     WHERE u.role = 'CLIENT' AND u.status <> 'DELETED' AND ${busqueda}
  )`;

interface FilaCliente {
  id: string;
  full_name: string;
  email: string;
  phone_e164: string | null;
  status: EstadoUsuario;
  created_at: Date;
  verificado: boolean;
  invitado_por: string | null;
  cuentas: number;
  vigentes: number;
  alguna_vencida: boolean;
  habilitado: boolean;
  referidor: boolean;
}

/** Busca por nombre, correo, teléfono o número de cuenta. Escapa los comodines de LIKE. */
function condicionBusqueda(q: string, parametros: unknown[]): string {
  const limpio = q.trim().slice(0, 80);
  if (!limpio) return 'true';
  parametros.push(`%${limpio.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const n = parametros.length;
  return `(u.full_name ILIKE $${n} OR u.email ILIKE $${n} OR u.phone_e164 ILIKE $${n}
           OR EXISTS (SELECT 1 FROM trading_accounts t
                       WHERE t.user_id = u.id AND t.deleted_at IS NULL AND t.account_number ILIKE $${n}))`;
}

/** El nombre con el que queda un cliente eliminado. Su correo es único e imposible de usar (dominio `.invalid`). */
export const NOMBRE_ELIMINADO = 'Cliente eliminado';
const correoEliminado = (id: string) => `eliminado-${id}@doctraderpro.invalid`;

/**
 * Eliminar la cuenta de un cliente que lo pida (`docs/legal/politica-datos.md` §9 y §10). Lo hace un admin desde la
 * ficha, con el segundo factor confirmado. Se borra o anonimiza todo lo personal y se conservan las órdenes y los
 * pagos (montos, fechas, hash y número de cuenta), que exigen las normas contables:
 * - El usuario queda DELETED, sin nombre, cédula, correo, teléfono, contraseña ni segundo factor; sus sesiones,
 *   dispositivos, enlaces, códigos de recuperación y correos se borran. Puede registrarse de nuevo.
 * - Sus licencias vigentes terminan (sin devolución). Sus cuentas de trading pierden el titular, las contraseñas y
 *   las notas; una cuenta conectada queda "por desconectar" para quitarla de Social Trader Tools, y las demás se
 *   marcan borradas.
 * - Sus tickets se borran, con sus adjuntos (los borra el trabajo de adjuntos).
 * - Las autorizaciones (`consents`) se conservan como prueba de lo que aceptó.
 */
@Injectable()
export class ClientesAdminService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
    private readonly sesiones: SesionesService,
  ) {}

  /** Todos los registrados, con filtros y búsqueda; quien no tiene cuenta de trading también aparece. */
  async listar(filtro: FiltroClientes, q: string) {
    const parametros: unknown[] = [];
    const base = CONSULTA_BASE(condicionBusqueda(q, parametros));
    const conteos = FILTROS_CLIENTES.map(
      (f) => `count(*) FILTER (WHERE ${CONDICION[f]})::int AS "${f}"`,
    ).join(', ');
    const [filas, [cuentas]] = await Promise.all([
      this.fuente.query(
        `${base} SELECT * FROM base WHERE ${CONDICION[filtro]}
          ORDER BY created_at DESC LIMIT ${MAXIMO_FILAS + 1}`,
        parametros,
      ) as Promise<FilaCliente[]>,
      this.fuente.query(`${base} SELECT ${conteos} FROM base`, parametros) as Promise<
        Record<FiltroClientes, number>[]
      >,
    ]);
    return {
      filtro,
      busqueda: q.trim().slice(0, 80),
      conteos: cuentas!,
      recortada: filas.length > MAXIMO_FILAS,
      clientes: filas.slice(0, MAXIMO_FILAS).map((f) => ({
        id: f.id,
        nombre: f.full_name,
        correo: f.email,
        correoVerificado: f.verificado,
        telefono: f.phone_e164,
        estado: f.status,
        desde: f.created_at,
        invitadoPor: f.invitado_por,
        cuentas: f.cuentas,
        licenciasVigentes: f.vigentes,
        algunaVencida: f.alguna_vencida,
        referidor: f.referidor,
        habilitado: f.habilitado,
      })),
    };
  }

  /** La ficha de un cliente: datos, cuentas con su licencia, pagos, tickets y su red de referidos. */
  async ficha(id: string) {
    const m = this.fuente.manager;
    const [usuario] = (await m.query(
      `SELECT u.id, u.full_name, u.email, u.email_verified_at, u.phone_e164, u.cedula_last4,
              u.document_country, u.document_type, u.status, u.created_at, u.marketing_opt_in
         FROM users u WHERE u.id = $1 AND u.role = 'CLIENT'`,
      [id],
    )) as {
      id: string;
      full_name: string;
      email: string;
      email_verified_at: Date | null;
      phone_e164: string | null;
      cedula_last4: string | null;
      document_country: string | null;
      document_type: string | null;
      status: EstadoUsuario;
      created_at: Date;
      marketing_opt_in: boolean;
    }[];
    if (!usuario) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese cliente.');
    }
    const [cuentas, ordenes, tickets, [red]] = await Promise.all([
      m.query(
        `SELECT t.id, t.account_number, t.broker, t.connection_status, t.created_at,
                l.id AS licencia_id, l.status AS licencia, l.ends_at, p.name AS plan
           FROM trading_accounts t
           LEFT JOIN licenses l ON l.trading_account_id = t.id
           LEFT JOIN plans p ON p.id = l.plan_id
          WHERE t.user_id = $1 AND t.deleted_at IS NULL
          ORDER BY t.created_at`,
        [id],
      ) as Promise<
        {
          id: string;
          account_number: string;
          broker: string;
          connection_status: EstadoConexion;
          created_at: Date;
          licencia_id: string | null;
          licencia: EstadoLicencia | null;
          ends_at: Date | null;
          plan: string | null;
        }[]
      >,
      m.query(
        `SELECT o.number, o.type, o.status, o.currency, o.amount_usd_cents, o.created_at, p.name AS plan,
                t.account_number AS cuenta
           FROM payment_orders o
           JOIN plans p ON p.id = o.plan_id
           LEFT JOIN licenses l ON l.id = o.license_id
           LEFT JOIN trading_accounts t ON t.id = l.trading_account_id
          WHERE o.user_id = $1 AND o.status IN ('REPORTADA', 'APROBADA', 'RECHAZADA')
          ORDER BY o.created_at DESC LIMIT 20`,
        [id],
      ) as Promise<
        {
          number: string;
          type: TipoOrden;
          status: EstadoOrden;
          currency: Moneda;
          amount_usd_cents: number;
          created_at: Date;
          plan: string;
          cuenta: string | null;
        }[]
      >,
      m.query(
        `SELECT number, topic, subject, status, created_at, last_message_at
           FROM tickets WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT 20`,
        [id],
      ) as Promise<
        {
          number: number;
          topic: TemaTicket;
          subject: string;
          status: EstadoTicket;
          created_at: Date;
          last_message_at: Date;
        }[]
      >,
      m.query(
        `SELECT (SELECT count(*)::int FROM users x WHERE x.referred_by = $1 AND x.status <> 'DELETED') AS primera,
                (SELECT count(*)::int FROM users x JOIN users i ON i.id = x.referred_by
                  WHERE i.referred_by = $1 AND x.id <> $1 AND x.status <> 'DELETED') AS segunda`,
        [id],
      ) as Promise<{ primera: number; segunda: number }[]>,
    ]);
    return {
      cliente: {
        id: usuario.id,
        nombre: usuario.full_name,
        correo: usuario.email,
        correoVerificado: usuario.email_verified_at !== null,
        telefono: usuario.phone_e164,
        cedulaFinal: usuario.cedula_last4,
        documentoPais: usuario.document_country,
        documentoTipo: usuario.document_type,
        estado: usuario.status,
        desde: usuario.created_at,
        aceptaPublicidad: usuario.marketing_opt_in,
      },
      cuentas: cuentas.map((c) => ({
        id: c.id,
        numero: c.account_number,
        broker: c.broker,
        conexion: c.connection_status,
        creadaEn: c.created_at,
        licencia: c.licencia_id
          ? { id: c.licencia_id, estado: c.licencia!, plan: c.plan, vence: c.ends_at }
          : null,
      })),
      pagos: ordenes.map((o) => ({
        numero: o.number,
        tipo: o.type,
        estado: o.status,
        moneda: o.currency,
        montoUsdCentavos: o.amount_usd_cents,
        plan: o.plan,
        cuenta: o.cuenta,
        creadaEn: o.created_at,
      })),
      tickets: tickets.map((t) => ({
        numero: t.number,
        tema: t.topic,
        asunto: t.subject,
        estado: t.status,
        creadoEn: t.created_at,
        ultimoMensaje: t.last_message_at,
      })),
      red: { primeraLinea: red?.primera ?? 0, segundaLinea: red?.segunda ?? 0 },
    };
  }

  async eliminar(id: string, motivo: string, sesion: SesionActiva, cliente: ContextoCliente) {
    const resultado = await this.fuente.transaction(async (m) => {
      const [usuario] = (await m.query(
        `SELECT id, role, status, email, full_name FROM users WHERE id = $1 FOR UPDATE`,
        [id],
      )) as { id: string; role: string; status: string; email: string; full_name: string }[];
      if (!usuario || usuario.role !== ROL.CLIENTE) {
        throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese cliente.');
      }
      if (usuario.status === ESTADO_USUARIO.BORRADO) {
        throw errorApi(HttpStatus.CONFLICT, 'YA_ELIMINADO', 'Este cliente ya fue eliminado.');
      }
      const [revision] = (await m.query(
        `SELECT number FROM payment_orders WHERE user_id = $1 AND status = 'REPORTADA' LIMIT 1`,
        [id],
      )) as { number: string }[];
      if (revision) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'PAGO_EN_REVISION',
          `El cliente tiene un pago en revisión (orden ${revision.number}). Apruébalo o recházalo antes de eliminarlo.`,
        );
      }

      // Órdenes sin pagar: ya no se pueden pagar. Licencias vigentes: terminan.
      await m.query(
        `UPDATE payment_orders SET status = 'CANCELADA', updated_at = now()
          WHERE user_id = $1 AND status = 'PENDIENTE'`,
        [id],
      );
      const [, licencias] = (await m.query(
        `UPDATE licenses SET status = 'VENCIDA', updated_at = now()
          WHERE user_id = $1 AND status IN ('ACTIVA', 'EN_GRACIA', 'SUSPENDIDA')`,
        [id],
      )) as [unknown, number];

      // Cuentas: la conectada queda por desconectar (y visible en la lista de trabajo); las demás, borradas.
      const [porDesconectar] = (await m.query(
        `UPDATE trading_accounts
            SET holder_name = $2, master_password_enc = NULL, investor_password_enc = NULL,
                passwords_purged_at = now(), internal_notes = NULL,
                connection_status = CASE connection_status
                  WHEN 'CONECTADA' THEN 'POR_DESCONECTAR'
                  WHEN 'POR_CONECTAR' THEN 'SIN_LICENCIA'
                  ELSE connection_status END,
                deleted_at = CASE WHEN connection_status IN ('CONECTADA', 'POR_DESCONECTAR')
                  THEN deleted_at ELSE coalesce(deleted_at, now()) END,
                updated_at = now()
          WHERE user_id = $1
          RETURNING connection_status`,
        [id, NOMBRE_ELIMINADO],
      )) as [{ connection_status: string }[], number];
      const desconectar = porDesconectar.filter((c) => c.connection_status === 'POR_DESCONECTAR');

      await m.query(
        `UPDATE files SET delete_after = now()
          WHERE owner_user_id = $1
             OR ticket_message_id IN (
               SELECT tm.id FROM ticket_messages tm JOIN tickets t ON t.id = tm.ticket_id WHERE t.user_id = $1
             )`,
        [id],
      );
      const [, tickets] = (await m.query(`DELETE FROM tickets WHERE user_id = $1`, [id])) as [
        unknown,
        number,
      ];
      // Referidos: su código y su dirección de cobro se borran. Los pagos ya cerrados conservan la dirección copiada,
      // para poder enviarlos; quien él invitó sigue registrado, sin referidor que pueda cobrar.
      await m.query(`DELETE FROM referral_profiles WHERE user_id = $1`, [id]);
      for (const tabla of ['user_devices', 'auth_tokens', 'recovery_codes', 'notifications']) {
        await m.query(`DELETE FROM ${tabla} WHERE user_id = $1`, [id]);
      }

      await m.query(
        `UPDATE users
            SET status = 'DELETED', deleted_at = now(), full_name = $2, email = $3, email_canonical = $3,
                email_verified_at = NULL, cedula_enc = NULL, cedula_hmac = NULL, cedula_last4 = NULL,
                document_country = NULL, document_type = NULL,
                phone_e164 = NULL, phone_verified_at = NULL, password_hash = NULL, totp_secret_enc = NULL,
                totp_enabled_at = NULL, marketing_opt_in = false, updated_at = now()
          WHERE id = $1`,
        [id, NOMBRE_ELIMINADO, correoEliminado(id)],
      );

      // El último correo va a la dirección real, sin ligarlo al usuario (que ya no tiene datos).
      await this.avisos.encolar(m, {
        usuarioId: null,
        correo: usuario.email,
        plantilla: PLANTILLA.CUENTA_ELIMINADA,
        datos: { nombre: primerNombre(usuario.full_name) },
      });
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'cliente.eliminado',
          targetType: 'user',
          targetId: id,
          // Sin datos personales: la auditoría se guarda 5 años.
          metadata: { motivo, licencias, tickets, porDesconectar: desconectar.length },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return { porDesconectar: desconectar.length };
    });
    await this.sesiones.cerrarTodas(id);
    return resultado;
  }
}
