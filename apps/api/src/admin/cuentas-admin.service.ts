import {
  ESTADO_CONEXION,
  type EstadoConexion,
  type EstadoLicencia,
  type EstadoVerificacion,
  type Moneda,
  type NivelRiesgo,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { TradingAccount, User } from '../database/entidades/index.js';
import {
  CONTEXTO_CONTRASENA_INVERSOR,
  CONTEXTO_CONTRASENA_OPERATIVA,
} from '../licencias/cuentas.service.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { errorApi } from '../seguridad/errores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';

interface FilaCuenta {
  id: string;
  connection_status: EstadoConexion;
  connection_changed_at: Date;
  connected_at: Date | null;
  holder_name: string;
  broker: string;
  server: string;
  account_number: string;
  recommended_capital_usd_cents: number | null;
  risk_level: NivelRiesgo | null;
  passwords_purged_at: Date | null;
  cliente_id: string;
  cliente: string;
  correo: string;
  telefono: string | null;
  licencia_id: string;
  licencia_estado: EstadoLicencia;
  ends_at: Date | null;
  grace_ends_at: Date | null;
  suspension_reason: string | null;
  plan: string | null;
  pagada_en: Date | null;
  moneda: Moneda | null;
}

const CONSULTA_CUENTAS = `
  SELECT t.id, t.connection_status, t.connection_changed_at, t.connected_at, t.holder_name, t.broker, t.server,
         t.account_number, t.recommended_capital_usd_cents, t.risk_level, t.passwords_purged_at,
         u.id AS cliente_id, u.full_name AS cliente, u.email AS correo, u.phone_e164 AS telefono,
         l.id AS licencia_id, l.status AS licencia_estado, l.ends_at, l.grace_ends_at, l.suspension_reason,
         p.name AS plan, ultima.decided_at AS pagada_en, ultima.currency AS moneda
    FROM trading_accounts t
    JOIN users u ON u.id = t.user_id
    JOIN licenses l ON l.trading_account_id = t.id
    LEFT JOIN plans p ON p.id = l.plan_id
    LEFT JOIN LATERAL (
      SELECT o.decided_at, o.currency FROM payment_orders o
       WHERE o.license_id = l.id AND o.status = 'APROBADA'
       ORDER BY o.decided_at DESC LIMIT 1
    ) ultima ON true
   WHERE t.deleted_at IS NULL`;

function vistaCuenta(f: FilaCuenta) {
  return {
    id: f.id,
    desde: f.connection_changed_at,
    // Ya estuvo conectada: volvió a "por conectar" porque el cliente cambió sus datos o renovó tras desconectarla.
    yaEstuvoConectada: f.connected_at !== null,
    cliente: { id: f.cliente_id, nombre: f.cliente, correo: f.correo, telefono: f.telefono },
    titular: f.holder_name,
    broker: f.broker,
    servidor: f.server,
    numero: f.account_number,
    capitalUsdCentavos: f.recommended_capital_usd_cents,
    riesgo: f.risk_level,
    contrasenasBorradas: f.passwords_purged_at !== null,
    licencia: {
      id: f.licencia_id,
      estado: f.licencia_estado,
      plan: f.plan,
      vence: f.ends_at,
      finGracia: f.grace_ends_at,
      motivoSuspension: f.suspension_reason,
    },
    pago: f.pagada_en ? { fecha: f.pagada_en, moneda: f.moneda } : null,
  };
}

export interface AsignacionCuenta {
  capitalUsdCentavos?: number | null;
  riesgo?: NivelRiesgo | null;
  notas?: string | null;
}

/**
 * Las listas de trabajo de Social Trader Tools (`docs/CONTEXTO.md`, "Conexión de cuentas"): qué cuentas conectar o
 * desconectar, con los datos para hacerlo, y las contraseñas solo con el segundo factor y en la auditoría.
 */
@Injectable()
export class CuentasAdminService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly cifrado: CifradoService,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  async listas() {
    const m = this.fuente.manager;
    const [porConectar, porDesconectar, esperandoPago, [conectadas]] = await Promise.all([
      m.query(
        `${CONSULTA_CUENTAS} AND t.connection_status = 'POR_CONECTAR' ORDER BY t.connection_changed_at`,
      ) as Promise<FilaCuenta[]>,
      m.query(
        `${CONSULTA_CUENTAS} AND t.connection_status = 'POR_DESCONECTAR' ORDER BY t.connection_changed_at`,
      ) as Promise<FilaCuenta[]>,
      // Cuentas que entran a "por conectar" apenas se apruebe el pago que ya reportaron.
      m.query(
        `SELECT t.id, t.account_number AS numero, t.broker, u.full_name AS cliente, p.name AS plan,
                o.number AS orden, o.verification_status AS verificacion, o.currency AS moneda, o.reported_at
           FROM payment_orders o
           JOIN trading_accounts t ON t.id = o.trading_account_id
           JOIN users u ON u.id = o.user_id
           JOIN plans p ON p.id = o.plan_id
          WHERE o.status = 'REPORTADA' AND t.deleted_at IS NULL
            AND t.connection_status IN ('SIN_LICENCIA', 'DESCONECTADA')
          ORDER BY o.reported_at`,
      ) as Promise<
        {
          id: string;
          numero: string;
          broker: string;
          cliente: string;
          plan: string;
          orden: string;
          verificacion: EstadoVerificacion | null;
          moneda: Moneda;
          reported_at: Date;
        }[]
      >,
      m.query(
        `SELECT count(*)::int AS n FROM trading_accounts
          WHERE connection_status = 'CONECTADA' AND deleted_at IS NULL`,
      ) as Promise<{ n: number }[]>,
    ]);
    return {
      porConectar: porConectar.map(vistaCuenta),
      porDesconectar: porDesconectar.map(vistaCuenta),
      esperandoPago: esperandoPago.map((e) => ({
        id: e.id,
        numero: e.numero,
        broker: e.broker,
        cliente: e.cliente,
        plan: e.plan,
        orden: e.orden,
        verificacion: e.verificacion,
        moneda: e.moneda,
        reportadaEn: e.reported_at,
      })),
      conectadas: conectadas?.n ?? 0,
    };
  }

  /**
   * Descifra las contraseñas de una cuenta. Solo con el segundo factor confirmado hace menos de 5 minutos (lo exige
   * la ruta) y cada vista queda en la auditoría (`docs/SEGURIDAD.md` §4.3).
   */
  async verContrasenas(id: string, sesion: SesionActiva, cliente: ContextoCliente) {
    return this.fuente.transaction(async (m) => {
      const cuenta = await m
        .getRepository(TradingAccount)
        .createQueryBuilder('t')
        .addSelect(['t.masterPasswordEnc', 't.investorPasswordEnc'])
        .where('t.id = :id AND t.deleted_at IS NULL', { id })
        .getOne();
      if (!cuenta) throw noEncontrada();
      if (!cuenta.masterPasswordEnc || !cuenta.investorPasswordEnc) {
        throw errorApi(
          HttpStatus.GONE,
          'CONTRASENAS_BORRADAS',
          'Las contraseñas de esta cuenta ya se borraron. Pídele al cliente que las vuelva a escribir.',
        );
      }
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'cuenta.ver_contrasenas',
          targetType: 'trading_account',
          targetId: cuenta.id,
          metadata: { numero: cuenta.accountNumber, broker: cuenta.broker },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return {
        operativa: this.cifrado.descifrar(cuenta.masterPasswordEnc, CONTEXTO_CONTRASENA_OPERATIVA),
        inversor: this.cifrado.descifrar(cuenta.investorPasswordEnc, CONTEXTO_CONTRASENA_INVERSOR),
      };
    });
  }

  /** Argemiro ya la conectó en Social Trader Tools: sale de la lista y el cliente recibe un correo. */
  async marcarConectada(id: string, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const cuenta = await this.bloquear(m, id);
      if (cuenta.connectionStatus !== ESTADO_CONEXION.POR_CONECTAR) throw yaNoEsta('por conectar');
      const ahora = new Date();
      await m.getRepository(TradingAccount).update(
        { id },
        {
          connectionStatus: ESTADO_CONEXION.CONECTADA,
          connectedAt: ahora,
          connectedBy: sesion.usuarioId,
        },
      );
      const dueno = await m.getRepository(User).findOneByOrFail({ id: cuenta.userId });
      await this.avisos.encolar(m, {
        usuarioId: dueno.id,
        correo: dueno.email,
        plantilla: PLANTILLA.CUENTA_CONECTADA,
        datos: {
          nombre: dueno.fullName.split(' ')[0] ?? dueno.fullName,
          cuenta: cuenta.accountNumber,
          broker: cuenta.broker,
          actualizada: cuenta.connectedAt ? 'si' : 'no',
        },
        clave: `cuenta-conectada:${cuenta.id}:${ahora.getTime()}`,
      });
      await this.registrar(m, sesion, cliente, 'cuenta.conectada', cuenta);
    });
  }

  /** Argemiro ya la desconectó en Social Trader Tools. */
  async marcarDesconectada(id: string, sesion: SesionActiva, cliente: ContextoCliente) {
    await this.fuente.transaction(async (m) => {
      const cuenta = await this.bloquear(m, id);
      if (cuenta.connectionStatus !== ESTADO_CONEXION.POR_DESCONECTAR) {
        throw yaNoEsta('por desconectar');
      }
      await m.getRepository(TradingAccount).update(
        { id },
        {
          connectionStatus: ESTADO_CONEXION.DESCONECTADA,
          disconnectedAt: new Date(),
          disconnectedBy: sesion.usuarioId,
        },
      );
      await this.registrar(m, sesion, cliente, 'cuenta.desconectada', cuenta);
    });
  }

  /** Capital recomendado, nivel de riesgo (los ve el cliente) y notas internas (solo admins). */
  async asignar(
    id: string,
    datos: AsignacionCuenta,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ) {
    await this.fuente.transaction(async (m) => {
      const cuenta = await m
        .getRepository(TradingAccount)
        .createQueryBuilder('t')
        .addSelect('t.internalNotes')
        .setLock('pessimistic_write')
        .where('t.id = :id AND t.deleted_at IS NULL', { id })
        .getOne();
      if (!cuenta) throw noEncontrada();
      const cambios: Partial<TradingAccount> = {};
      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};
      if (
        datos.capitalUsdCentavos !== undefined &&
        datos.capitalUsdCentavos !== cuenta.recommendedCapitalUsdCents
      ) {
        cambios.recommendedCapitalUsdCents = datos.capitalUsdCentavos;
        antes.capitalUsdCentavos = cuenta.recommendedCapitalUsdCents;
        despues.capitalUsdCentavos = datos.capitalUsdCentavos;
      }
      if (datos.riesgo !== undefined && datos.riesgo !== cuenta.riskLevel) {
        cambios.riskLevel = datos.riesgo;
        antes.riesgo = cuenta.riskLevel;
        despues.riesgo = datos.riesgo;
      }
      const notas = datos.notas === undefined ? undefined : datos.notas?.trim() || null;
      // De las notas solo se anota que cambiaron: pueden tener datos del cliente.
      const notasCambiaron = notas !== undefined && notas !== (cuenta.internalNotes ?? null);
      if (notasCambiaron) cambios.internalNotes = notas;
      if (Object.keys(cambios).length === 0) return;
      await m.getRepository(TradingAccount).update({ id }, cambios);
      await this.registrar(m, sesion, cliente, 'cuenta.asignacion', cuenta, {
        antes,
        despues,
        notasCambiaron,
      });
    });
  }

  private async bloquear(m: EntityManager, id: string) {
    const cuenta = await m
      .getRepository(TradingAccount)
      .createQueryBuilder('t')
      .setLock('pessimistic_write')
      .where('t.id = :id AND t.deleted_at IS NULL', { id })
      .getOne();
    if (!cuenta) throw noEncontrada();
    return cuenta;
  }

  private registrar(
    m: EntityManager,
    sesion: SesionActiva,
    cliente: ContextoCliente,
    accion: string,
    cuenta: TradingAccount,
    extra: Record<string, unknown> = {},
  ) {
    return this.auditoria.registrar(
      {
        actorId: sesion.usuarioId,
        actorRole: sesion.rol,
        action: accion,
        targetType: 'trading_account',
        targetId: cuenta.id,
        metadata: { numero: cuenta.accountNumber, broker: cuenta.broker, ...extra },
        ip: cliente.ip,
        userAgent: cliente.userAgent ?? null,
      },
      m,
    );
  }
}

function noEncontrada() {
  return errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa cuenta.');
}

function yaNoEsta(lista: string) {
  return errorApi(
    HttpStatus.CONFLICT,
    'YA_NO_ESTA',
    `Esta cuenta ya no está ${lista}. Recarga la página.`,
  );
}
