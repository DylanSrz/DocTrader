import {
  CODIGO_PLAN,
  ESTADO_LICENCIA,
  ESTADO_SOLICITUD_PRUEBA,
  type EstadoLicencia,
  type EstadoSolicitudPrueba,
  HUELLAS_QUE_BLOQUEAN,
  MOTIVO_BLOQUEO,
  numeroParecido,
  TIPO_HUELLA,
  type TipoHuella,
  titularParecido,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { CONTEXTO as CONTEXTO_ACCESO } from '../acceso/acceso.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import {
  type Coincidencia,
  License,
  Plan,
  TradingAccount,
  TrialRequest,
  User,
} from '../database/entidades/index.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { errorApi } from '../seguridad/errores.js';
import { LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { datosDeLaPrueba, HuellasPrueba } from './huellas.js';
import { TelefonoService } from './telefono.service.js';

const LIMITE_SOLICITUDES = { nombre: 'solicitud-prueba', maximo: 5, ventana: 3_600 };

const fecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

function cerrada() {
  return errorApi(
    HttpStatus.SERVICE_UNAVAILABLE,
    'PRUEBA_NO_DISPONIBLE',
    'Por ahora no estamos recibiendo solicitudes de prueba. Escríbenos a soporte.',
  );
}

type Quien = { sesion: SesionActiva; cliente: ContextoCliente };

/**
 * La licencia de prueba (`docs/CONTEXTO.md`, "Control de la prueba"): el cliente la pide con su correo y su teléfono
 * verificados; la plataforma la bloquea si la cédula, la cuenta, el correo o el teléfono ya tuvieron prueba, y si
 * no, se la muestra al admin con las señales que encontró. Aprobada, el cliente paga su orden de USD 50.
 */
@Injectable()
export class PruebaService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly huellas: HuellasPrueba,
    private readonly telefono: TelefonoService,
    private readonly cifrado: CifradoService,
    private readonly limites: LimitesService,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  /** Abierta solo con la llave de las huellas y un proveedor de SMS. */
  get disponible(): boolean {
    return this.huellas.disponible && this.telefono.disponible;
  }

  // ── Cliente ─────────────────────────────────────────────────────────────────────────────────────────

  /** Lo que el panel necesita para mostrar la prueba: requisitos, cuentas elegibles y la solicitud vigente. */
  async estado(usuarioId: string) {
    const m = this.fuente.manager;
    const [usuario, plan, cuentas, solicitudes] = await Promise.all([
      m.getRepository(User).findOneByOrFail({ id: usuarioId }),
      m.getRepository(Plan).findOneBy({ code: CODIGO_PLAN.PRUEBA }),
      m.query(
        `SELECT t.id, t.account_number AS numero, t.broker, t.server AS servidor, l.status
           FROM trading_accounts t JOIN licenses l ON l.trading_account_id = t.id
          WHERE t.user_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at`,
        [usuarioId],
      ) as Promise<
        { id: string; numero: string; broker: string; servidor: string; status: EstadoLicencia }[]
      >,
      m.query(
        `SELECT r.id, r.status, r.block_reasons, r.decision_note, r.created_at, r.decided_at,
                r.trading_account_id, t.account_number AS numero, t.broker,
                o.number AS orden, o.status AS estado_orden
           FROM trial_requests r
           JOIN trading_accounts t ON t.id = r.trading_account_id
           LEFT JOIN payment_orders o ON o.id = r.payment_order_id
          WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 5`,
        [usuarioId],
      ) as Promise<
        {
          id: string;
          status: EstadoSolicitudPrueba;
          block_reasons: Coincidencia[];
          decision_note: string | null;
          created_at: Date;
          decided_at: Date | null;
          trading_account_id: string;
          numero: string;
          broker: string;
          orden: string | null;
          estado_orden: string | null;
        }[]
      >,
    ]);
    const ultima = solicitudes[0];
    return {
      disponible: this.disponible,
      precioUsdCentavos: plan?.priceUsdCents ?? null,
      dias: plan?.durationDays ?? null,
      correoVerificado: usuario.emailVerifiedAt !== null,
      telefono: usuario.phoneE164,
      telefonoVerificado: usuario.phoneVerifiedAt !== null,
      // Solo las cuentas que nunca se han pagado pueden empezar con una prueba.
      cuentas: cuentas
        .filter((c) => c.status === ESTADO_LICENCIA.PENDIENTE_PAGO)
        .map((c) => ({ id: c.id, numero: c.numero, broker: c.broker, servidor: c.servidor })),
      solicitud: ultima
        ? {
            id: ultima.id,
            estado: ultima.status,
            cuentaId: ultima.trading_account_id,
            cuenta: { numero: ultima.numero, broker: ultima.broker },
            motivos: ultima.block_reasons.map((b) => b.texto),
            motivoRechazo: ultima.status === 'RECHAZADA' ? ultima.decision_note : null,
            creadaEn: ultima.created_at,
            decididaEn: ultima.decided_at,
            orden: ultima.orden ? { numero: ultima.orden, estado: ultima.estado_orden } : null,
          }
        : null,
    };
  }

  /**
   * Envía la solicitud. Si algún dato ya tuvo prueba, queda BLOQUEADA (se guarda para el admin y el cliente ve el
   * motivo); si no, queda PENDIENTE con las señales que encontró y les llega un correo a los admins.
   */
  async solicitar(cuentaId: string, { sesion, cliente }: Quien) {
    if (!this.disponible) throw cerrada();
    await this.limites.exigir(LIMITE_SOLICITUDES, sesion.usuarioId);
    const resultado = await this.fuente
      .transaction(async (m) => {
        const usuario = await m
          .getRepository(User)
          .createQueryBuilder('u')
          .setLock('pessimistic_write')
          .where('u.id = :id', { id: sesion.usuarioId })
          .getOneOrFail();
        if (!usuario.emailVerifiedAt || !usuario.phoneVerifiedAt) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'CONTACTO_SIN_VERIFICAR',
            'Para pedir la prueba, verifica primero tu correo y tu teléfono.',
          );
        }
        const cuenta = await m
          .getRepository(TradingAccount)
          .findOneBy({ id: cuentaId, userId: usuario.id });
        if (!cuenta || cuenta.deletedAt) {
          throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa cuenta.');
        }
        const licencia = await m
          .getRepository(License)
          .findOneByOrFail({ tradingAccountId: cuenta.id });
        if (licencia.status !== ESTADO_LICENCIA.PENDIENTE_PAGO) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'CUENTA_NO_ELEGIBLE',
            'La prueba es para una cuenta que todavía no tiene licencia.',
          );
        }

        const datos = datosDeLaPrueba({
          cedula: usuario.cedulaEnc
            ? this.cifrado.descifrar(usuario.cedulaEnc, CONTEXTO_ACCESO.cedula)
            : null,
          correo: usuario.email,
          telefono: usuario.phoneE164,
          broker: cuenta.broker,
          servidor: cuenta.server,
          numero: cuenta.accountNumber,
          dispositivo: sesion.dispositivo,
        });
        const encontradas = await this.huellas.buscar(m, datos);
        const bloqueos = HUELLAS_QUE_BLOQUEAN.filter((tipo) =>
          encontradas.some((e) => e.tipo === tipo),
        ).map((tipo): Coincidencia => ({
          tipo,
          texto: MOTIVO_BLOQUEO[tipo as keyof typeof MOTIVO_BLOQUEO],
          solicitudId: encontradas.find((e) => e.tipo === tipo)?.solicitudId ?? null,
        }));
        const dispositivo = datos.find((d) => d.tipo === TIPO_HUELLA.DISPOSITIVO);
        const base = {
          userId: usuario.id,
          tradingAccountId: cuenta.id,
          deviceHash: dispositivo ? this.huellas.huella(dispositivo) : null,
          ip: cliente.ip,
        };

        if (bloqueos.length > 0) {
          const insertada = await m.getRepository(TrialRequest).insert({
            ...base,
            status: ESTADO_SOLICITUD_PRUEBA.BLOQUEADA,
            blockReasons: bloqueos,
          });
          await this.registrar(
            m,
            sesion,
            cliente,
            'prueba.bloqueada',
            insertada.identifiers[0]!.id,
            {
              motivos: bloqueos.map((b) => b.tipo),
            },
          );
          return {
            estado: ESTADO_SOLICITUD_PRUEBA.BLOQUEADA,
            motivos: bloqueos.map((b) => b.texto),
          };
        }

        const senales = await this.senales(m, usuario.id, cuenta, encontradas, cliente.ip);
        const insertada = await m.getRepository(TrialRequest).insert({
          ...base,
          status: ESTADO_SOLICITUD_PRUEBA.PENDIENTE,
          signals: senales,
        });
        const id = insertada.identifiers[0]!.id as string;
        await this.registrar(m, sesion, cliente, 'prueba.solicitada', id, {
          cuenta: cuenta.accountNumber,
          senales: senales.length,
        });
        await this.avisarAdmins(m, usuario, cuenta, senales.length);
        return { estado: ESTADO_SOLICITUD_PRUEBA.PENDIENTE, motivos: [] as string[] };
      })
      .catch((error: unknown) => {
        if (
          error instanceof QueryFailedError &&
          (error.driverError as { constraint?: string }).constraint === 'trial_requests_una_vigente'
        ) {
          throw errorApi(
            HttpStatus.CONFLICT,
            'SOLICITUD_VIGENTE',
            'Ya tienes una solicitud de prueba en revisión o aprobada.',
          );
        }
        throw error;
      });
    return resultado;
  }

  /**
   * Señales para el admin: no bloquean, pero aparecen junto a la solicitud. Se comparan con las pruebas aprobadas
   * que todavía existen (titular y número parecidos, misma IP) y con el registro de huellas (número de cuenta en otro
   * broker, mismo dispositivo).
   */
  private async senales(
    m: EntityManager,
    usuarioId: string,
    cuenta: TradingAccount,
    encontradas: { tipo: TipoHuella; solicitudId: string }[],
    ip: string,
  ): Promise<Coincidencia[]> {
    const anteriores = (await m.query(
      `SELECT r.id, r.ip, u.full_name AS cliente, t.holder_name AS titular, t.account_number AS numero,
              t.broker, r.created_at
         FROM trial_requests r
         JOIN users u ON u.id = r.user_id
         JOIN trading_accounts t ON t.id = r.trading_account_id
        WHERE r.status = 'APROBADA' AND r.user_id <> $1
        ORDER BY r.created_at DESC LIMIT 1000`,
      [usuarioId],
    )) as {
      id: string;
      ip: string | null;
      cliente: string;
      titular: string;
      numero: string;
      broker: string;
      created_at: Date;
    }[];
    const de = (id: string) => anteriores.find((a) => a.id === id);
    const cuando = (d: Date) => fecha.format(d).replace(/^\d+ de /, '');
    const senales: Coincidencia[] = [];

    for (const tipo of [TIPO_HUELLA.NUMERO_CUENTA, TIPO_HUELLA.DISPOSITIVO] as const) {
      const hallada = encontradas.find((e) => e.tipo === tipo);
      if (!hallada) continue;
      const anterior = de(hallada.solicitudId);
      const quien = anterior ? ` (${anterior.cliente}, ${cuando(anterior.created_at)})` : '';
      senales.push({
        tipo,
        texto:
          tipo === TIPO_HUELLA.NUMERO_CUENTA
            ? `El número ${cuenta.accountNumber} ya tuvo una prueba en otro broker o servidor${quien}.`
            : `Mismo dispositivo que una prueba anterior${quien}.`,
        solicitudId: hallada.solicitudId,
      });
    }
    const mismaIp = anteriores.find((a) => a.ip && a.ip === ip);
    if (mismaIp) {
      senales.push({
        tipo: 'IP',
        texto: `Misma IP que la prueba de ${mismaIp.cliente} (${cuando(mismaIp.created_at)}). Puede ser alguien en la misma casa u oficina.`,
        solicitudId: mismaIp.id,
      });
    }
    const titular = anteriores.find((a) => titularParecido(a.titular, cuenta.holderName));
    if (titular) {
      senales.push({
        tipo: 'TITULAR',
        texto: `El titular se parece al de la prueba de ${titular.cliente} ("${titular.titular}", ${cuando(titular.created_at)}).`,
        solicitudId: titular.id,
      });
    }
    const numero = anteriores.find((a) => numeroParecido(a.numero, cuenta.accountNumber));
    if (numero) {
      senales.push({
        tipo: 'NUMERO_PARECIDO',
        texto: `El número ${cuenta.accountNumber} se parece a la cuenta ${numero.numero} (${numero.broker}) de la prueba de ${numero.cliente}. Pídele que confirme el titular.`,
        solicitudId: numero.id,
      });
    }
    const [historial] = (await m.query(
      `SELECT count(*) FILTER (WHERE status = 'RECHAZADA')::int AS rechazadas,
              count(*) FILTER (WHERE status = 'BLOQUEADA')::int AS bloqueadas
         FROM trial_requests WHERE user_id = $1`,
      [usuarioId],
    )) as { rechazadas: number; bloqueadas: number }[];
    if (historial && historial.rechazadas > 0) {
      senales.push({
        tipo: 'RECHAZADA_ANTES',
        texto:
          historial.rechazadas === 1
            ? 'A este cliente ya le rechazamos una solicitud.'
            : `A este cliente ya le rechazamos ${historial.rechazadas} solicitudes.`,
      });
    }
    if (historial && historial.bloqueadas > 0) {
      senales.push({
        tipo: 'BLOQUEADA_ANTES',
        texto: 'Este cliente intentó antes con datos que ya habían tenido prueba.',
      });
    }
    return senales;
  }

  private async avisarAdmins(
    m: EntityManager,
    cliente: User,
    cuenta: TradingAccount,
    senales: number,
  ) {
    const admins = await m.getRepository(User).findBy({ role: 'ADMIN', status: 'ACTIVE' });
    for (const admin of admins) {
      await this.avisos.encolar(m, {
        usuarioId: admin.id,
        correo: admin.email,
        plantilla: PLANTILLA.PRUEBA_SOLICITADA,
        datos: {
          nombre: admin.fullName.split(' ')[0] ?? admin.fullName,
          cliente: cliente.fullName,
          cuenta: `${cuenta.accountNumber} (${cuenta.broker})`,
          senales:
            senales === 0
              ? 'No encontramos coincidencias con pruebas anteriores.'
              : senales === 1
                ? 'Encontramos 1 señal para revisar.'
                : `Encontramos ${senales} señales para revisar.`,
        },
        clave: `prueba-solicitada:${cuenta.id}:${admin.id}:${Date.now()}`,
      });
    }
  }

  // ── Admin ───────────────────────────────────────────────────────────────────────────────────────────

  async listarAdmin() {
    const m = this.fuente.manager;
    const consulta = `
      SELECT r.id, r.status, r.signals, r.block_reasons, r.decision_note, r.created_at, r.decided_at,
             u.id AS cliente_id, u.full_name AS cliente, u.email AS correo,
             t.account_number AS numero, t.broker, t.server AS servidor, t.holder_name AS titular,
             o.number AS orden, o.status AS estado_orden
        FROM trial_requests r
        JOIN users u ON u.id = r.user_id
        JOIN trading_accounts t ON t.id = r.trading_account_id
        LEFT JOIN payment_orders o ON o.id = r.payment_order_id`;
    type Fila = {
      id: string;
      status: EstadoSolicitudPrueba;
      signals: Coincidencia[];
      block_reasons: Coincidencia[];
      decision_note: string | null;
      created_at: Date;
      decided_at: Date | null;
      cliente_id: string;
      cliente: string;
      correo: string;
      numero: string;
      broker: string;
      servidor: string;
      titular: string;
      orden: string | null;
      estado_orden: string | null;
    };
    const [pendientes, bloqueadas, decididas] = await Promise.all([
      m.query(`${consulta} WHERE r.status = 'PENDIENTE' ORDER BY r.created_at`) as Promise<Fila[]>,
      m.query(
        `${consulta} WHERE r.status = 'BLOQUEADA' AND r.created_at > now() - interval '30 days'
          ORDER BY r.created_at DESC LIMIT 50`,
      ) as Promise<Fila[]>,
      m.query(
        `${consulta} WHERE r.status IN ('APROBADA', 'RECHAZADA') AND r.decided_at > now() - interval '30 days'
          ORDER BY r.decided_at DESC LIMIT 50`,
      ) as Promise<Fila[]>,
    ]);
    const vista = (f: Fila) => ({
      id: f.id,
      estado: f.status,
      cliente: { id: f.cliente_id, nombre: f.cliente, correo: f.correo },
      cuenta: { numero: f.numero, broker: f.broker, servidor: f.servidor, titular: f.titular },
      senales: f.signals.map((s) => ({ tipo: s.tipo, texto: s.texto })),
      bloqueos: f.block_reasons.map((b) => ({ tipo: b.tipo, texto: b.texto })),
      motivoRechazo: f.decision_note,
      creadaEn: f.created_at,
      decididaEn: f.decided_at,
      orden: f.orden ? { numero: f.orden, estado: f.estado_orden } : null,
    });
    return {
      disponible: this.disponible,
      pendientes: pendientes.map(vista),
      bloqueadas: bloqueadas.map(vista),
      decididas: decididas.map(vista),
    };
  }

  /**
   * Aprobar: la solicitud queda APROBADA, el cliente puede crear su orden de USD 50 y las huellas entran al registro
   * desde ya (`docs/MODELO-DATOS.md` §3.5): aunque no pague, esa persona y esa cuenta ya usaron su prueba.
   */
  async aprobar(id: string, { sesion, cliente }: Quien) {
    await this.fuente.transaction(async (m) => {
      const solicitud = await this.bloquear(m, id);
      const usuario = await m.getRepository(User).findOneByOrFail({ id: solicitud.userId });
      const cuenta = await m
        .getRepository(TradingAccount)
        .findOneByOrFail({ id: solicitud.tradingAccountId });
      await m.getRepository(TrialRequest).update(
        { id },
        {
          status: ESTADO_SOLICITUD_PRUEBA.APROBADA,
          decidedBy: sesion.usuarioId,
          decidedAt: new Date(),
        },
      );
      const datos = datosDeLaPrueba({
        cedula: usuario.cedulaEnc
          ? this.cifrado.descifrar(usuario.cedulaEnc, CONTEXTO_ACCESO.cedula)
          : null,
        correo: usuario.email,
        telefono: usuario.phoneE164,
        broker: cuenta.broker,
        servidor: cuenta.server,
        numero: cuenta.accountNumber,
        dispositivo: null,
      });
      await this.huellas.registrar(m, id, datos);
      if (solicitud.deviceHash) {
        // El dispositivo ya viene como huella: se guarda tal cual.
        await m.query(
          `INSERT INTO trial_registry (kind, fingerprint, key_version, trial_request_id)
           VALUES ('DISPOSITIVO', $1, 1, $2) ON CONFLICT DO NOTHING`,
          [solicitud.deviceHash, id],
        );
      }
      const plan = await m.getRepository(Plan).findOneByOrFail({ code: CODIGO_PLAN.PRUEBA });
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.PRUEBA_APROBADA,
        datos: {
          nombre: usuario.fullName.split(' ')[0] ?? usuario.fullName,
          cuenta: cuenta.accountNumber,
          dias: String(plan.durationDays ?? 15),
          precio: String(plan.priceUsdCents / 100),
        },
        clave: `prueba-aprobada:${id}`,
      });
      await this.registrar(m, sesion, cliente, 'prueba.aprobada', id, {
        cliente: usuario.id,
        cuenta: cuenta.accountNumber,
      });
    });
  }

  async rechazar(id: string, motivo: string, { sesion, cliente }: Quien) {
    await this.fuente.transaction(async (m) => {
      const solicitud = await this.bloquear(m, id);
      const usuario = await m.getRepository(User).findOneByOrFail({ id: solicitud.userId });
      await m.getRepository(TrialRequest).update(
        { id },
        {
          status: ESTADO_SOLICITUD_PRUEBA.RECHAZADA,
          decidedBy: sesion.usuarioId,
          decidedAt: new Date(),
          decisionNote: motivo,
        },
      );
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.PRUEBA_RECHAZADA,
        datos: { nombre: usuario.fullName.split(' ')[0] ?? usuario.fullName, motivo },
        clave: `prueba-rechazada:${id}`,
      });
      await this.registrar(m, sesion, cliente, 'prueba.rechazada', id, { motivo });
    });
  }

  private async bloquear(m: EntityManager, id: string) {
    const solicitud = await m
      .getRepository(TrialRequest)
      .createQueryBuilder('r')
      .setLock('pessimistic_write')
      .where('r.id = :id', { id })
      .getOne();
    if (!solicitud) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa solicitud.');
    }
    if (solicitud.status !== ESTADO_SOLICITUD_PRUEBA.PENDIENTE) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'NO_REVISABLE',
        'Esta solicitud ya no está por revisar. Recarga la página.',
      );
    }
    return solicitud;
  }

  private registrar(
    m: EntityManager,
    sesion: SesionActiva,
    cliente: ContextoCliente,
    accion: string,
    id: string,
    metadata: Record<string, unknown>,
  ) {
    return this.auditoria.registrar(
      {
        actorId: sesion.usuarioId,
        actorRole: sesion.rol,
        action: accion,
        targetType: 'trial_request',
        targetId: id,
        metadata,
        ip: cliente.ip,
        userAgent: cliente.userAgent ?? null,
      },
      m,
    );
  }
}
