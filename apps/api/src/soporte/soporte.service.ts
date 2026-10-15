import {
  ESTADO_TICKET,
  type EstadoOrden,
  type EstadoTicket,
  LIMITES_TICKET,
  NOMBRE_TEMA,
  type PrioridadTicket,
  ROL,
  type TemaTicket,
} from '@doctrader/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { type Adjunto, ArchivosService } from '../archivos/archivos.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { fechaSinHora } from '../avisos/fecha.js';
import { PLANTILLA, type Plantilla } from '../avisos/plantillas.js';
import { Ticket, User } from '../database/entidades/index.js';
import { errorApi } from '../seguridad/errores.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import type {
  CambiarTicketDto,
  MensajeAdminDto,
  MensajeDto,
  NuevoTicketDto,
  RespuestaGuardadaDto,
  VistaBandeja,
} from './dto.js';

/** Así firma el equipo ante el cliente: el panel nunca muestra el nombre de un admin (`CLAUDE.md`). */
export const NOMBRE_EQUIPO = 'DocTrader Pro';
/** Días de cierre si alguien borró el ajuste. */
const DIAS_CIERRE_POR_DEFECTO = 7;
/** Lo que va del mensaje en el correo al cliente; el resto lo lee en el panel. */
const LARGO_EN_CORREO = 1500;

interface Quien {
  sesion: SesionActiva;
  cliente: ContextoCliente;
}

interface FilaMensaje {
  id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: Date;
  autor: string;
  rol: string;
}

const noEncontrado = () =>
  errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese ticket.');

const cerrado = () =>
  errorApi(
    HttpStatus.CONFLICT,
    'TICKET_CERRADO',
    'Este ticket ya está cerrado. Si necesitas algo más, abre un ticket nuevo.',
  );

const primerNombre = (nombre: string) => nombre.split(' ')[0] ?? nombre;

function recortarParaCorreo(texto: string): string {
  return texto.length > LARGO_EN_CORREO ? `${texto.slice(0, LARGO_EN_CORREO).trimEnd()}…` : texto;
}

export async function leerDiasCierre(m: EntityManager): Promise<number> {
  const [fila] = (await m.query(
    `SELECT value FROM settings WHERE key = 'tickets.auto_close_days'`,
  )) as { value: unknown }[];
  const dias = fila?.value;
  return typeof dias === 'number' && Number.isSafeInteger(dias) && dias >= 1
    ? dias
    : DIAS_CIERRE_POR_DEFECTO;
}

/**
 * Soporte por tickets (`docs/CONTEXTO.md`, "Registro y soporte"; estados en `docs/MODELO-DATOS.md` §4.5). El cliente
 * abre, responde, marca resuelto y reabre; los admins responden, dejan notas internas, asignan, cambian la
 * prioridad y resuelven. El worker cierra los resueltos que pasan sus días sin respuesta.
 */
@Injectable()
export class SoporteService {
  private readonly logger = new Logger(SoporteService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly archivos: ArchivosService,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
    private readonly limites: LimitesService,
  ) {}

  // ── Cliente ───────────────────────────────────────────────────────────────────────────────────────

  async listarCliente(usuarioId: string) {
    const m = this.fuente.manager;
    const [tickets, cuentas, ordenes, diasCierre] = await Promise.all([
      m.query(
        `SELECT t.id, t.number, t.subject, t.topic, t.status, t.last_message_at, t.created_at,
                a.account_number AS cuenta, o.number AS orden
           FROM tickets t
           LEFT JOIN trading_accounts a ON a.id = t.trading_account_id
           LEFT JOIN payment_orders o ON o.id = t.payment_order_id
          WHERE t.user_id = $1
          ORDER BY (t.status = 'RESPONDIDO') DESC, t.last_message_at DESC
          LIMIT 100`,
        [usuarioId],
      ) as Promise<
        {
          id: string;
          number: number;
          subject: string;
          topic: TemaTicket;
          status: EstadoTicket;
          last_message_at: Date;
          created_at: Date;
          cuenta: string | null;
          orden: string | null;
        }[]
      >,
      m.query(
        `SELECT id, account_number, broker FROM trading_accounts
          WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [usuarioId],
      ) as Promise<{ id: string; account_number: string; broker: string }[]>,
      m.query(
        `SELECT o.id, o.number, o.status, p.name AS plan, a.account_number AS cuenta
           FROM payment_orders o
           JOIN plans p ON p.id = o.plan_id
           JOIN trading_accounts a ON a.id = o.trading_account_id
          WHERE o.user_id = $1 AND o.created_at > now() - interval '90 days'
          ORDER BY o.created_at DESC LIMIT 20`,
        [usuarioId],
      ) as Promise<
        { id: string; number: string; status: EstadoOrden; plan: string; cuenta: string }[]
      >,
      leerDiasCierre(m),
    ]);
    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        numero: t.number,
        asunto: t.subject,
        tema: t.topic,
        estado: t.status,
        cuenta: t.cuenta,
        orden: t.orden,
        ultimoMensaje: t.last_message_at,
        creadoEn: t.created_at,
      })),
      cuentas: cuentas.map((c) => ({ id: c.id, numero: c.account_number, broker: c.broker })),
      ordenes: ordenes.map((o) => ({
        id: o.id,
        numero: o.number,
        estado: o.status,
        plan: o.plan,
        cuenta: o.cuenta,
      })),
      adjuntos: this.archivos.disponible,
      diasCierre,
    };
  }

  async verCliente(usuarioId: string, numero: number) {
    const m = this.fuente.manager;
    const ticket = await this.ticketDe(m, numero);
    if (!ticket || ticket.userId !== usuarioId) throw noEncontrado();
    const [mensajes, relacion, diasCierre] = await Promise.all([
      this.mensajes(m, ticket.id, false),
      this.relacion(m, ticket),
      leerDiasCierre(m),
    ]);
    return {
      ...this.cabecera(ticket),
      ...relacion,
      cierraEn: this.cierraEn(ticket, diasCierre),
      adjuntos: this.archivos.disponible,
      mensajes: mensajes.map((x) => ({
        id: x.id,
        deEquipo: x.author_id !== ticket.userId,
        autor: x.author_id === ticket.userId ? 'Tú' : NOMBRE_EQUIPO,
        texto: x.body,
        creadoEn: x.created_at,
        adjuntos: x.adjuntos,
      })),
    };
  }

  async crear(dto: NuevoTicketDto, quien: Quien) {
    const usuarioId = quien.sesion.usuarioId;
    await this.limites.exigir(LIMITES.ticketsPorUsuario, usuarioId);
    return this.fuente.transaction(async (m) => {
      const cliente = await m.getRepository(User).findOneByOrFail({ id: usuarioId });
      if (dto.cuentaId) {
        const [cuenta] = (await m.query(
          `SELECT 1 FROM trading_accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
          [dto.cuentaId, usuarioId],
        )) as unknown[];
        if (!cuenta) {
          throw errorApi(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Revisa los datos marcados.', {
            campos: { cuentaId: 'Elige una de tus cuentas.' },
          });
        }
      }
      if (dto.ordenId) {
        const [orden] = (await m.query(
          `SELECT 1 FROM payment_orders WHERE id = $1 AND user_id = $2`,
          [dto.ordenId, usuarioId],
        )) as unknown[];
        if (!orden) {
          throw errorApi(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Revisa los datos marcados.', {
            campos: { ordenId: 'Elige una de tus órdenes.' },
          });
        }
      }
      const [{ abiertos }] = (await m.query(
        `SELECT count(*)::int AS abiertos FROM tickets
          WHERE user_id = $1 AND status IN ('ABIERTO', 'RESPONDIDO')`,
        [usuarioId],
      )) as { abiertos: number }[];
      if (abiertos >= LIMITES_TICKET.abiertosPorCliente) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'MUCHOS_TICKETS',
          'Tienes muchos tickets abiertos. Escribe en uno de ellos y te respondemos ahí.',
        );
      }

      const [ticket] = (await m.query(
        `INSERT INTO tickets (user_id, topic, trading_account_id, payment_order_id, subject)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, number`,
        [usuarioId, dto.tema, dto.cuentaId ?? null, dto.ordenId ?? null, dto.asunto],
      )) as { id: string; number: number }[];
      const mensajeId = await this.insertarMensaje(m, ticket!.id, usuarioId, dto.mensaje, false);
      await this.archivos.adjuntar(m, { usuarioId, mensajeId, ids: dto.adjuntos ?? [] });
      await this.avisarAdmins(m, PLANTILLA.TICKET_NUEVO, {
        clave: `ticket:${ticket!.id}:nuevo`,
        datos: {
          cliente: cliente.fullName,
          numero: String(ticket!.number),
          asunto: dto.asunto,
          tema: NOMBRE_TEMA[dto.tema],
        },
      });
      return { numero: ticket!.number };
    });
  }

  /**
   * El cliente escribe en su ticket. Si estaba respondido vuelve a "sin responder"; si estaba resuelto se reabre y se
   * avisa a los admins. Uno cerrado ya no recibe mensajes.
   */
  async responderCliente(numero: number, dto: MensajeDto, quien: Quien) {
    const usuarioId = quien.sesion.usuarioId;
    await this.limites.exigir(LIMITES.mensajesPorUsuario, usuarioId);
    await this.fuente.transaction(async (m) => {
      const ticket = await this.ticketDe(m, numero, true);
      if (!ticket || ticket.userId !== usuarioId) throw noEncontrado();
      if (ticket.status === ESTADO_TICKET.CERRADO) throw cerrado();
      const mensajeId = await this.insertarMensaje(m, ticket.id, usuarioId, dto.mensaje, false);
      await this.archivos.adjuntar(m, { usuarioId, mensajeId, ids: dto.adjuntos ?? [] });
      // "Esperando desde" cuenta desde el primer mensaje sin respuesta: si ya estaba abierto, no se mueve.
      await m.query(
        `UPDATE tickets SET status = 'ABIERTO', resolved_at = NULL, last_message_at = now(),
                last_client_message_at = CASE WHEN status = 'ABIERTO' THEN last_client_message_at ELSE now() END,
                updated_at = now()
          WHERE id = $1`,
        [ticket.id],
      );
      if (ticket.status === ESTADO_TICKET.RESUELTO) {
        const cliente = await m.getRepository(User).findOneByOrFail({ id: usuarioId });
        await this.avisarAdmins(m, PLANTILLA.TICKET_REABIERTO, {
          clave: `ticket:${ticket.id}:reabierto:${mensajeId}`,
          datos: {
            cliente: cliente.fullName,
            numero: String(ticket.number),
            asunto: ticket.subject,
            tema: NOMBRE_TEMA[ticket.topic],
          },
        });
      }
    });
  }

  /** "Mi problema ya se resolvió". */
  async resolverCliente(numero: number, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const ticket = await this.ticketDe(m, numero, true);
      if (!ticket || ticket.userId !== quien.sesion.usuarioId) throw noEncontrado();
      if (ticket.status === ESTADO_TICKET.CERRADO) throw cerrado();
      if (ticket.status === ESTADO_TICKET.RESUELTO) return;
      await this.marcarResuelto(m, ticket.id);
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────────────────────────

  async bandeja(vista: VistaBandeja = 'sin', tema?: TemaTicket) {
    const m = this.fuente.manager;
    const ESTADOS: Record<VistaBandeja, EstadoTicket[]> = {
      sin: [ESTADO_TICKET.ABIERTO],
      abiertos: [ESTADO_TICKET.ABIERTO, ESTADO_TICKET.RESPONDIDO],
      resueltos: [ESTADO_TICKET.RESUELTO, ESTADO_TICKET.CERRADO],
      todos: Object.values(ESTADO_TICKET),
    };
    // Sin responder: el que más lleva esperando primero. Las demás: lo más reciente primero.
    const orden =
      vista === 'sin'
        ? `t.priority = 'ALTA' DESC, t.last_client_message_at ASC`
        : `t.last_message_at DESC`;
    const [tickets, [conteos], [tiempos], admins] = await Promise.all([
      m.query(
        `SELECT t.id, t.number, t.subject, t.topic, t.status, t.priority, t.last_client_message_at,
                t.last_message_at, c.full_name AS cliente, s.full_name AS asignado, a.account_number AS cuenta
           FROM tickets t
           JOIN users c ON c.id = t.user_id
           LEFT JOIN users s ON s.id = t.assigned_to
           LEFT JOIN trading_accounts a ON a.id = t.trading_account_id
          WHERE t.status = ANY($1) AND ($2::text IS NULL OR t.topic = $2)
          ORDER BY ${orden}
          LIMIT 100`,
        [ESTADOS[vista], tema ?? null],
      ) as Promise<
        {
          id: string;
          number: number;
          subject: string;
          topic: TemaTicket;
          status: EstadoTicket;
          priority: PrioridadTicket;
          last_client_message_at: Date;
          last_message_at: Date;
          cliente: string;
          asignado: string | null;
          cuenta: string | null;
        }[]
      >,
      m.query(
        `SELECT count(*) FILTER (WHERE status = 'ABIERTO')::int AS sin,
                count(*) FILTER (WHERE status IN ('ABIERTO', 'RESPONDIDO'))::int AS abiertos,
                count(*) FILTER (WHERE status IN ('RESUELTO', 'CERRADO'))::int AS resueltos,
                count(*)::int AS todos
           FROM tickets WHERE ($1::text IS NULL OR topic = $1)`,
        [tema ?? null],
      ) as Promise<{ sin: number; abiertos: number; resueltos: number; todos: number }[]>,
      m.query(
        `SELECT round(avg(extract(epoch FROM first_response_at - created_at)) / 60)::int AS primera,
                (SELECT min(last_client_message_at) FROM tickets WHERE status = 'ABIERTO') AS mas_antiguo,
                (SELECT number FROM tickets WHERE status = 'ABIERTO'
                  ORDER BY priority = 'ALTA' DESC, last_client_message_at LIMIT 1) AS siguiente
           FROM tickets WHERE first_response_at >= now() - interval '7 days'`,
      ) as Promise<
        { primera: number | null; mas_antiguo: Date | null; siguiente: number | null }[]
      >,
      this.admins(m),
    ]);
    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        numero: t.number,
        asunto: t.subject,
        tema: t.topic,
        estado: t.status,
        prioridad: t.priority,
        cliente: t.cliente,
        asignado: t.asignado,
        cuenta: t.cuenta,
        esperaDesde: t.last_client_message_at,
        ultimoMensaje: t.last_message_at,
      })),
      conteos: conteos!,
      primeraRespuestaMinutos: tiempos?.primera ?? null,
      masAntiguo: tiempos?.mas_antiguo ?? null,
      siguiente: tiempos?.siguiente ?? null,
      admins,
    };
  }

  async verAdmin(numero: number) {
    const m = this.fuente.manager;
    const ticket = await this.ticketDe(m, numero);
    if (!ticket) throw noEncontrado();
    const [mensajes, relacion, cliente, admins, respuestas, diasCierre] = await Promise.all([
      this.mensajes(m, ticket.id, true),
      this.relacion(m, ticket),
      m.getRepository(User).findOneByOrFail({ id: ticket.userId }),
      this.admins(m),
      this.respuestas(m),
      leerDiasCierre(m),
    ]);
    return {
      ...this.cabecera(ticket),
      ...relacion,
      prioridad: ticket.priority,
      asignadoA: ticket.assignedTo,
      primeraRespuesta: ticket.firstResponseAt,
      esperaDesde: ticket.lastClientMessageAt,
      cierraEn: this.cierraEn(ticket, diasCierre),
      cliente: { id: cliente.id, nombre: cliente.fullName, correo: cliente.email },
      adjuntos: this.archivos.disponible,
      admins,
      respuestas,
      mensajes: mensajes.map((x) => ({
        id: x.id,
        deEquipo: x.rol === ROL.ADMIN,
        interna: x.is_internal,
        autor: x.autor,
        texto: x.body,
        creadoEn: x.created_at,
        adjuntos: x.adjuntos,
      })),
    };
  }

  /** Respuesta al cliente (le llega por correo) o nota interna (solo la ven los admins). */
  async responderAdmin(numero: number, dto: MensajeAdminDto, quien: Quien) {
    const adminId = quien.sesion.usuarioId;
    await this.fuente.transaction(async (m) => {
      const ticket = await this.ticketDe(m, numero, true);
      if (!ticket) throw noEncontrado();
      if (ticket.status === ESTADO_TICKET.CERRADO) throw cerrado();
      const interna = dto.interna === true;
      const mensajeId = await this.insertarMensaje(m, ticket.id, adminId, dto.mensaje, interna);
      await this.archivos.adjuntar(m, { usuarioId: adminId, mensajeId, ids: dto.adjuntos ?? [] });
      await this.registrar(m, quien, interna ? 'ticket.nota' : 'ticket.respondido', ticket, {
        mensaje: mensajeId,
      });
      if (interna) return;

      await m.query(
        `UPDATE tickets SET status = 'RESPONDIDO', resolved_at = NULL, last_message_at = now(),
                first_response_at = coalesce(first_response_at, now()), updated_at = now()
          WHERE id = $1`,
        [ticket.id],
      );
      const cliente = await m.getRepository(User).findOneByOrFail({ id: ticket.userId });
      await this.avisos.encolar(m, {
        usuarioId: cliente.id,
        correo: cliente.email,
        plantilla: PLANTILLA.TICKET_RESPONDIDO,
        datos: {
          nombre: primerNombre(cliente.fullName),
          numero: String(ticket.number),
          asunto: ticket.subject,
          mensaje: recortarParaCorreo(dto.mensaje),
        },
        clave: `ticket:${ticket.id}:respuesta:${mensajeId}`,
      });
    });
  }

  async resolverAdmin(numero: number, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const ticket = await this.ticketDe(m, numero, true);
      if (!ticket) throw noEncontrado();
      if (ticket.status === ESTADO_TICKET.CERRADO) throw cerrado();
      if (ticket.status === ESTADO_TICKET.RESUELTO) return;
      await this.marcarResuelto(m, ticket.id);
      await this.registrar(m, quien, 'ticket.resuelto', ticket, {});
      // En una transacción las consultas van una tras otra: comparten la conexión.
      const cliente = await m.getRepository(User).findOneByOrFail({ id: ticket.userId });
      const dias = await leerDiasCierre(m);
      await this.avisos.encolar(m, {
        usuarioId: cliente.id,
        correo: cliente.email,
        plantilla: PLANTILLA.TICKET_RESUELTO,
        datos: {
          nombre: primerNombre(cliente.fullName),
          numero: String(ticket.number),
          asunto: ticket.subject,
          cierre: fechaSinHora(new Date(Date.now() + dias * 86_400_000)),
        },
        clave: `ticket:${ticket.id}:resuelto:${Date.now()}`,
      });
    });
  }

  async cambiar(numero: number, dto: CambiarTicketDto, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const ticket = await this.ticketDe(m, numero, true);
      if (!ticket) throw noEncontrado();
      const cambios: Partial<Ticket> = {};
      if (dto.asignadoA !== undefined && dto.asignadoA !== ticket.assignedTo) {
        if (dto.asignadoA !== null) {
          const admin = await m
            .getRepository(User)
            .findOneBy({ id: dto.asignadoA, role: ROL.ADMIN, status: 'ACTIVE' });
          if (!admin) {
            throw errorApi(
              HttpStatus.BAD_REQUEST,
              'DATOS_INVALIDOS',
              'Revisa los datos marcados.',
              {
                campos: { asignadoA: 'Elige uno de los administradores.' },
              },
            );
          }
        }
        cambios.assignedTo = dto.asignadoA;
      }
      if (dto.prioridad && dto.prioridad !== ticket.priority) cambios.priority = dto.prioridad;
      if (Object.keys(cambios).length === 0) return;
      await m.getRepository(Ticket).update({ id: ticket.id }, cambios);
      await this.registrar(m, quien, 'ticket.cambiado', ticket, {
        antes: {
          ...('assignedTo' in cambios ? { asignadoA: ticket.assignedTo } : {}),
          ...(cambios.priority ? { prioridad: ticket.priority } : {}),
        },
        despues: {
          ...('assignedTo' in cambios ? { asignadoA: cambios.assignedTo } : {}),
          ...(cambios.priority ? { prioridad: cambios.priority } : {}),
        },
      });
    });
  }

  // ── Respuestas guardadas ──────────────────────────────────────────────────────────────────────────

  listarRespuestas() {
    return this.respuestas(this.fuente.manager);
  }

  async crearRespuesta(dto: RespuestaGuardadaDto, quien: Quien) {
    return this.fuente.transaction(async (m) => {
      const [{ n }] = (await m.query(`SELECT count(*)::int AS n FROM saved_replies`)) as {
        n: number;
      }[];
      if (n >= LIMITES_TICKET.respuestasGuardadas) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'MUCHAS_RESPUESTAS',
          `Puedes tener hasta ${LIMITES_TICKET.respuestasGuardadas} respuestas guardadas. Borra alguna que ya no uses.`,
        );
      }
      const [fila] = (await m
        .query(
          `INSERT INTO saved_replies (title, body, created_by) VALUES ($1, $2, $3) RETURNING id`,
          [dto.titulo, dto.cuerpo, quien.sesion.usuarioId],
        )
        .catch(tituloRepetido)) as { id: string }[];
      await this.registrarRespuesta(m, quien, 'respuesta.creada', fila!.id, dto.titulo);
      return { id: fila!.id };
    });
  }

  async editarRespuesta(id: string, dto: RespuestaGuardadaDto, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const [, filas] = (await m
        .query(`UPDATE saved_replies SET title = $2, body = $3, updated_at = now() WHERE id = $1`, [
          id,
          dto.titulo,
          dto.cuerpo,
        ])
        .catch(tituloRepetido)) as [unknown, number];
      if (filas === 0) {
        throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'Esa respuesta ya no existe.');
      }
      await this.registrarRespuesta(m, quien, 'respuesta.editada', id, dto.titulo);
    });
  }

  async borrarRespuesta(id: string, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const [filas] = (await m.query(`DELETE FROM saved_replies WHERE id = $1 RETURNING title`, [
        id,
      ])) as [{ title: string }[], number];
      if (filas.length === 0) return;
      await this.registrarRespuesta(m, quien, 'respuesta.borrada', id, filas[0]!.title);
    });
  }

  // ── Ajustes y worker ──────────────────────────────────────────────────────────────────────────────

  async guardarDiasCierre(dias: number, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const antes = await leerDiasCierre(m);
      if (antes === dias) return;
      await m.query(
        `INSERT INTO settings (key, value, updated_by) VALUES ('tickets.auto_close_days', $1::jsonb, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [JSON.stringify(dias), quien.sesion.usuarioId],
      );
      await this.auditoria.registrar(
        {
          actorId: quien.sesion.usuarioId,
          actorRole: quien.sesion.rol,
          action: 'ajustes.soporte',
          targetType: 'settings',
          targetId: 'tickets.auto_close_days',
          metadata: { antes, despues: dias },
          ip: quien.cliente.ip,
          userAgent: quien.cliente.userAgent ?? null,
        },
        m,
      );
    });
  }

  /** Trabajo del worker (cada hora): los resueltos que pasaron sus días sin respuesta se cierran. */
  async cerrarResueltos(): Promise<number> {
    const dias = await leerDiasCierre(this.fuente.manager);
    const [filas] = (await this.fuente.query(
      `UPDATE tickets SET status = 'CERRADO', closed_at = now(), updated_at = now()
        WHERE status = 'RESUELTO' AND resolved_at <= now() - make_interval(days => $1)
        RETURNING id`,
      [dias],
    )) as [{ id: string }[], number];
    if (filas.length) this.logger.log(`Tickets cerrados: ${filas.length}`);
    return filas.length;
  }

  // ── Ayudas ────────────────────────────────────────────────────────────────────────────────────────

  private async ticketDe(m: EntityManager, numero: number, bloquear = false) {
    const consulta = m.getRepository(Ticket).createQueryBuilder('t').where('t.number = :numero', {
      numero,
    });
    if (bloquear) consulta.setLock('pessimistic_write');
    return consulta.getOne();
  }

  private cabecera(t: Ticket) {
    return {
      id: t.id,
      numero: t.number,
      asunto: t.subject,
      tema: t.topic,
      estado: t.status,
      creadoEn: t.createdAt,
      resueltoEn: t.resolvedAt,
      cerradoEn: t.closedAt,
    };
  }

  /** Cuándo se cierra solo un ticket resuelto. */
  private cierraEn(t: Ticket, dias: number): Date | null {
    return t.status === ESTADO_TICKET.RESUELTO && t.resolvedAt
      ? new Date(t.resolvedAt.getTime() + dias * 86_400_000)
      : null;
  }

  private async relacion(m: EntityManager, t: Ticket) {
    const [cuenta] = t.tradingAccountId
      ? ((await m.query(`SELECT id, account_number, broker FROM trading_accounts WHERE id = $1`, [
          t.tradingAccountId,
        ])) as { id: string; account_number: string; broker: string }[])
      : [];
    const [orden] = t.paymentOrderId
      ? ((await m.query(`SELECT number, status FROM payment_orders WHERE id = $1`, [
          t.paymentOrderId,
        ])) as { number: string; status: EstadoOrden }[])
      : [];
    return {
      cuenta: cuenta
        ? { id: cuenta.id, numero: cuenta.account_number, broker: cuenta.broker }
        : null,
      orden: orden ? { numero: orden.number, estado: orden.status } : null,
    };
  }

  private async mensajes(
    m: EntityManager,
    ticketId: string,
    conInternas: boolean,
  ): Promise<(FilaMensaje & { adjuntos: Adjunto[] })[]> {
    const filas = (await m.query(
      `SELECT x.id, x.author_id, x.body, x.is_internal, x.created_at, u.full_name AS autor, u.role AS rol
         FROM ticket_messages x JOIN users u ON u.id = x.author_id
        WHERE x.ticket_id = $1 AND ($2 OR NOT x.is_internal)
        ORDER BY x.created_at, x.id`,
      [ticketId, conInternas],
    )) as FilaMensaje[];
    const adjuntos = await this.archivos.deMensajes(
      m,
      filas.map((f) => f.id),
    );
    return filas.map((f) => ({ ...f, adjuntos: adjuntos.get(f.id) ?? [] }));
  }

  private async insertarMensaje(
    m: EntityManager,
    ticketId: string,
    autorId: string,
    texto: string,
    interna: boolean,
  ): Promise<string> {
    const [fila] = (await m.query(
      `INSERT INTO ticket_messages (ticket_id, author_id, body, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ticketId, autorId, texto, interna],
    )) as { id: string }[];
    return fila!.id;
  }

  private async marcarResuelto(m: EntityManager, ticketId: string) {
    await m.query(
      `UPDATE tickets SET status = 'RESUELTO', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [ticketId],
    );
  }

  private async admins(m: EntityManager) {
    const filas = await m.getRepository(User).find({
      where: { role: ROL.ADMIN, status: 'ACTIVE' },
      order: { createdAt: 'ASC' },
    });
    return filas.map((a) => ({ id: a.id, nombre: a.fullName }));
  }

  private async respuestas(m: EntityManager) {
    const filas = (await m.query(
      `SELECT id, title, body FROM saved_replies ORDER BY lower(title)`,
    )) as { id: string; title: string; body: string }[];
    return filas.map((r) => ({ id: r.id, titulo: r.title, cuerpo: r.body }));
  }

  private async avisarAdmins(
    m: EntityManager,
    plantilla: Plantilla,
    aviso: { clave: string; datos: Record<string, string> },
  ) {
    const admins = await m.getRepository(User).findBy({ role: ROL.ADMIN, status: 'ACTIVE' });
    for (const admin of admins) {
      await this.avisos.encolar(m, {
        usuarioId: admin.id,
        correo: admin.email,
        plantilla,
        datos: { nombre: primerNombre(admin.fullName), ...aviso.datos },
        clave: `${aviso.clave}:${admin.id}`,
      });
    }
  }

  private registrar(
    m: EntityManager,
    quien: Quien,
    accion: string,
    ticket: Ticket,
    metadata: Record<string, unknown>,
  ) {
    return this.auditoria.registrar(
      {
        actorId: quien.sesion.usuarioId,
        actorRole: quien.sesion.rol,
        action: accion,
        targetType: 'ticket',
        targetId: ticket.id,
        metadata: { numero: String(ticket.number), ...metadata },
        ip: quien.cliente.ip,
        userAgent: quien.cliente.userAgent ?? null,
      },
      m,
    );
  }

  private registrarRespuesta(
    m: EntityManager,
    quien: Quien,
    accion: string,
    id: string,
    titulo: string,
  ) {
    return this.auditoria.registrar(
      {
        actorId: quien.sesion.usuarioId,
        actorRole: quien.sesion.rol,
        action: accion,
        targetType: 'saved_reply',
        targetId: id,
        metadata: { titulo },
        ip: quien.cliente.ip,
        userAgent: quien.cliente.userAgent ?? null,
      },
      m,
    );
  }
}

function tituloRepetido(error: unknown): never {
  if (
    error instanceof QueryFailedError &&
    (error.driverError as { constraint?: string }).constraint === 'saved_replies_titulo'
  ) {
    throw errorApi(HttpStatus.CONFLICT, 'TITULO_REPETIDO', 'Ya hay una respuesta con ese título.', {
      campos: { titulo: 'Ya hay una respuesta con ese título.' },
    });
  }
  throw error;
}
