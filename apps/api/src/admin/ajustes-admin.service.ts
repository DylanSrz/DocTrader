import {
  CODIGO_PLAN,
  type CodigoPlan,
  ESTADO_DIRECCION,
  type EstadoDireccion,
  type Moneda,
  NOMBRE_RED,
  RED_DE_MONEDA,
  type Red,
} from '@doctrader/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { fechaLegible } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import type { CifrasMyfxbook, Enlaces } from '../contenido/contenido.service.js';
import { DepositAddress, Plan, User } from '../database/entidades/index.js';
import { leerAjustes } from '../licencias/ajustes.js';
import { direccionBitcoinValida } from '../pagos/bitcoin.js';
import { direccionTronValida } from '../pagos/tron.js';
import { errorApi } from '../seguridad/errores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';

/** Una dirección nueva espera esto antes de ofrecerse a los clientes (`docs/SEGURIDAD.md` §5). */
export const ESPERA_DIRECCION_MS = 24 * 60 * 60_000;

/** Los planes cuyo precio se edita en el panel. La trimestral ya no se vende. */
const PLANES_EDITABLES: CodigoPlan[] = [
  CODIGO_PLAN.MENSUAL,
  CODIGO_PLAN.SEMESTRAL,
  CODIGO_PLAN.PRUEBA,
];

const VALIDA: Record<Red, (direccion: string) => boolean> = {
  TRON: direccionTronValida,
  BITCOIN: direccionBitcoinValida,
};

export interface Precios {
  MENSUAL: number;
  SEMESTRAL: number;
  PRUEBA: number;
  diasPrueba: number;
}

export interface AjustesOperacion {
  diasGracia: number;
  minutosOrden: number;
  confirmacionesTron: number;
  confirmacionesBitcoin: number;
}

interface Quien {
  sesion: SesionActiva;
  cliente: ContextoCliente;
}

/** Ajustes del panel: precios, plazos, confirmaciones, enlaces, cifras de Myfxbook y direcciones de depósito. */
@Injectable()
export class AjustesAdminService {
  private readonly logger = new Logger(AjustesAdminService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  async leer() {
    const m = this.fuente.manager;
    const [planes, ajustes, otros, direcciones] = await Promise.all([
      m.getRepository(Plan).find({ order: { rank: 'ASC' } }),
      leerAjustes(m),
      m.query(
        `SELECT key, value FROM settings WHERE key IN ('links', 'myfxbook', 'support_email', 'faq')`,
      ) as Promise<{ key: string; value: unknown }[]>,
      m.query(
        `SELECT d.id, d.currency, d.network, d.address, d.status, d.activates_at, d.created_at,
                c.full_name AS creada_por
           FROM deposit_addresses d LEFT JOIN users c ON c.id = d.created_by
          WHERE d.status <> 'CANCELADA' OR d.updated_at > now() - interval '30 days'
          ORDER BY d.network, d.created_at DESC`,
      ) as Promise<
        {
          id: string;
          currency: Moneda;
          network: Red;
          address: string;
          status: EstadoDireccion;
          activates_at: Date;
          created_at: Date;
          creada_por: string | null;
        }[]
      >,
    ]);
    const valor = new Map(otros.map((o) => [o.key, o.value]));
    const prueba = planes.find((p) => p.code === CODIGO_PLAN.PRUEBA);
    // La dirección que reciben las órdenes nuevas de cada red: la activa más reciente.
    const enUso = new Map<Red, string>();
    for (const d of [...direcciones].sort(
      (a, b) => b.activates_at.getTime() - a.activates_at.getTime(),
    )) {
      if (d.status === ESTADO_DIRECCION.ACTIVA && !enUso.has(d.network)) enUso.set(d.network, d.id);
    }
    return {
      planes: planes
        .filter((p) => PLANES_EDITABLES.includes(p.code))
        .map((p) => ({
          codigo: p.code,
          nombre: p.name,
          meses: p.durationMonths,
          dias: p.durationDays,
          precioUsdCentavos: p.priceUsdCents,
        })),
      diasPrueba: prueba?.durationDays ?? 15,
      diasGracia: ajustes.diasGracia,
      minutosOrden: ajustes.minutosOrden,
      confirmaciones: ajustes.confirmaciones,
      aprobacionAutomatica: ajustes.aprobacionAutomatica,
      enlaces: (valor.get('links') as Enlaces | undefined) ?? null,
      myfxbook: (valor.get('myfxbook') as CifrasMyfxbook | undefined) ?? null,
      correoSoporte: (valor.get('support_email') as string | undefined) ?? null,
      preguntas: Array.isArray(valor.get('faq')) ? (valor.get('faq') as unknown[]).length : 0,
      direcciones: direcciones.map((d) => ({
        id: d.id,
        moneda: d.currency,
        red: d.network,
        direccion: d.address,
        estado: d.status,
        activaDesde: d.activates_at,
        creadaEn: d.created_at,
        creadaPor: d.creada_por,
        enUso: enUso.get(d.network) === d.id,
      })),
    };
  }

  /** Precios en centavos. Cada orden copia el precio, así que esto solo cambia las órdenes nuevas. */
  async guardarPrecios(precios: Precios, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const planes = await m.getRepository(Plan).find();
      const antes: Record<string, number | null> = {};
      const despues: Record<string, number | null> = {};
      for (const codigo of [CODIGO_PLAN.MENSUAL, CODIGO_PLAN.SEMESTRAL, CODIGO_PLAN.PRUEBA]) {
        const plan = planes.find((p) => p.code === codigo);
        const nuevo = precios[codigo as 'MENSUAL' | 'SEMESTRAL' | 'PRUEBA'];
        if (!plan || plan.priceUsdCents === nuevo) continue;
        antes[codigo] = plan.priceUsdCents;
        despues[codigo] = nuevo;
        await m.getRepository(Plan).update({ id: plan.id }, { priceUsdCents: nuevo });
      }
      const prueba = planes.find((p) => p.code === CODIGO_PLAN.PRUEBA);
      if (prueba && prueba.durationDays !== precios.diasPrueba) {
        antes.diasPrueba = prueba.durationDays;
        despues.diasPrueba = precios.diasPrueba;
        await m.getRepository(Plan).update({ id: prueba.id }, { durationDays: precios.diasPrueba });
      }
      await this.validarPrecios(m);
      if (Object.keys(despues).length === 0) return;
      await this.registrar(m, quien, 'ajustes.precios', 'plans', { antes, despues });
    });
  }

  /** La prueba no puede costar lo mismo o más que el plan más barato: la diferencia para completarla sería cero. */
  private async validarPrecios(m: EntityManager) {
    const planes = await m.getRepository(Plan).find({ where: { isActive: true } });
    const prueba = planes.find((p) => p.code === CODIGO_PLAN.PRUEBA);
    const masBarato = Math.min(
      ...planes.filter((p) => p.code !== CODIGO_PLAN.PRUEBA).map((p) => p.priceUsdCents),
    );
    if (prueba && prueba.priceUsdCents >= masBarato) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'PRECIO_PRUEBA',
        'La prueba debe costar menos que el plan mensual: el cliente la completa pagando la diferencia.',
        { campos: { PRUEBA: 'Debe ser menor que el precio mensual.' } },
      );
    }
  }

  /** Días de gracia, vigencia de la orden y confirmaciones mínimas. */
  async guardarOperacion(datos: AjustesOperacion, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const actual = await leerAjustes(m);
      const nuevos: Record<string, unknown> = {
        grace_days: datos.diasGracia,
        order_ttl_minutes: datos.minutosOrden,
        min_confirmations: { TRON: datos.confirmacionesTron, BITCOIN: datos.confirmacionesBitcoin },
      };
      const anteriores: Record<string, unknown> = {
        grace_days: actual.diasGracia,
        order_ttl_minutes: actual.minutosOrden,
        min_confirmations: actual.confirmaciones,
      };
      const cambiados = Object.keys(nuevos).filter(
        (k) => JSON.stringify(nuevos[k]) !== JSON.stringify(anteriores[k]),
      );
      if (cambiados.length === 0) return;
      for (const clave of cambiados) await this.guardarAjuste(m, clave, nuevos[clave], quien);
      await this.registrar(m, quien, 'ajustes.operacion', 'settings', {
        antes: Object.fromEntries(cambiados.map((k) => [k, anteriores[k]])),
        despues: Object.fromEntries(cambiados.map((k) => [k, nuevos[k]])),
      });
    });
  }

  async guardarEnlaces(enlaces: Enlaces, correoSoporte: string, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      await this.guardarAjuste(m, 'links', enlaces, quien);
      await this.guardarAjuste(m, 'support_email', correoSoporte, quien);
      await this.registrar(m, quien, 'ajustes.enlaces', 'settings', {
        despues: { ...enlaces, correoSoporte },
      });
    });
  }

  async guardarMyfxbook(cifras: CifrasMyfxbook, quien: Quien) {
    await this.fuente.transaction(async (m) => {
      const [fila] = (await m.query(`SELECT value FROM settings WHERE key = 'myfxbook'`)) as {
        value: Record<string, unknown>;
      }[];
      // Se conserva lo que el panel no edita (el número de cuenta, por ejemplo).
      const valor = { ...fila?.value, ...cifras };
      await this.guardarAjuste(m, 'myfxbook', valor, quien);
      await this.registrar(m, quien, 'ajustes.myfxbook', 'settings', { despues: cifras });
    });
  }

  // ── Direcciones de depósito ───────────────────────────────────────────────────────────────────────

  /**
   * Agrega una dirección (con el segundo factor confirmado, lo exige la ruta). Queda en espera 24 horas y les llega
   * un correo a los dos admins con la dirección completa, para que cualquiera la cancele si no la reconoce.
   */
  async agregarDireccion(moneda: Moneda, direccion: string, quien: Quien) {
    const red = RED_DE_MONEDA[moneda];
    const limpia = direccion.trim();
    if (!VALIDA[red](limpia)) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'DIRECCION_INVALIDA',
        `Esa no es una dirección válida de ${NOMBRE_RED[red]}. Cópiala otra vez desde tu billetera.`,
        {
          campos: {
            direccion: `Revisa la dirección: no es de ${NOMBRE_RED[red]} o le falta un carácter.`,
          },
        },
      );
    }
    return this.fuente.transaction(async (m) => {
      const activa = new Date(Date.now() + ESPERA_DIRECCION_MS);
      const [fila] = (await m.query(
        `INSERT INTO deposit_addresses (currency, network, address, status, activates_at, created_by)
         VALUES ($1, $2, $3, 'EN_ESPERA', $4, $5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [moneda, red, limpia, activa, quien.sesion.usuarioId],
      )) as { id: string }[];
      if (!fila) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'DIRECCION_REPETIDA',
          'Esa dirección ya está en la lista.',
        );
      }
      await this.registrar(
        m,
        quien,
        'direccion.agregada',
        'deposit_address',
        {
          moneda,
          red,
          direccion: limpia,
          activaDesde: activa.toISOString(),
        },
        fila.id,
      );
      await this.avisarAdmins(m, quien, {
        accion: 'agregada',
        verbo: 'agregó',
        red: NOMBRE_RED[red],
        direccion: limpia,
        activa: fechaLegible(activa),
        clave: `direccion:${fila.id}:agregada`,
      });
      return { id: fila.id, activaDesde: activa };
    });
  }

  /** Cancelar una dirección en espera. No pide el segundo factor: es la salida de emergencia. */
  async cancelarDireccion(id: string, quien: Quien) {
    await this.cambiarDireccion(id, quien, {
      desde: ESTADO_DIRECCION.EN_ESPERA,
      hacia: ESTADO_DIRECCION.CANCELADA,
      accion: 'cancelada',
      verbo: 'canceló',
      error: 'Solo se cancela una dirección en espera.',
    });
  }

  async desactivarDireccion(id: string, quien: Quien) {
    await this.cambiarDireccion(id, quien, {
      desde: ESTADO_DIRECCION.ACTIVA,
      hacia: ESTADO_DIRECCION.INACTIVA,
      accion: 'desactivada',
      verbo: 'desactivó',
      error: 'Esta dirección no está activa.',
    });
  }

  async reactivarDireccion(id: string, quien: Quien) {
    await this.cambiarDireccion(id, quien, {
      desde: ESTADO_DIRECCION.INACTIVA,
      hacia: ESTADO_DIRECCION.ACTIVA,
      accion: 'reactivada',
      verbo: 'reactivó',
      error: 'Esta dirección no está inactiva.',
    });
  }

  private async cambiarDireccion(
    id: string,
    quien: Quien,
    cambio: {
      desde: EstadoDireccion;
      hacia: EstadoDireccion;
      accion: string;
      verbo: string;
      error: string;
    },
  ) {
    await this.fuente.transaction(async (m) => {
      const direccion = await m
        .getRepository(DepositAddress)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id })
        .getOne();
      if (!direccion) {
        throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADA', 'No encontramos esa dirección.');
      }
      if (direccion.status !== cambio.desde) {
        throw errorApi(HttpStatus.CONFLICT, 'ESTADO_DIRECCION', cambio.error);
      }
      await m.getRepository(DepositAddress).update(
        { id },
        {
          status: cambio.hacia,
          ...(cambio.hacia === ESTADO_DIRECCION.CANCELADA
            ? { cancelledBy: quien.sesion.usuarioId }
            : {}),
        },
      );
      await this.registrar(
        m,
        quien,
        `direccion.${cambio.accion}`,
        'deposit_address',
        {
          red: direccion.network,
          direccion: direccion.address,
        },
        id,
      );
      await this.avisarAdmins(m, quien, {
        accion: cambio.accion,
        verbo: cambio.verbo,
        red: NOMBRE_RED[direccion.network],
        direccion: direccion.address,
        clave: `direccion:${id}:${cambio.accion}:${Date.now()}`,
      });
    });
  }

  /** Trabajo del worker (cada minuto): las direcciones que cumplieron sus 24 horas pasan a activas. */
  async activarDirecciones(): Promise<number> {
    const [filas] = (await this.fuente.query(
      `UPDATE deposit_addresses SET status = 'ACTIVA', updated_at = now()
        WHERE status = 'EN_ESPERA' AND activates_at <= now() RETURNING id, network`,
    )) as [{ id: string; network: Red }[], number];
    if (filas.length) this.logger.log(`Direcciones activadas: ${filas.length}`);
    return filas.length;
  }

  private async avisarAdmins(
    m: EntityManager,
    quien: Quien,
    datos: {
      accion: string;
      verbo: string;
      red: string;
      direccion: string;
      activa?: string;
      clave: string;
    },
  ) {
    const admins = await m.getRepository(User).find({
      where: { role: 'ADMIN', status: 'ACTIVE' },
    });
    const autor = admins.find((a) => a.id === quien.sesion.usuarioId);
    for (const admin of admins) {
      await this.avisos.encolar(m, {
        usuarioId: admin.id,
        correo: admin.email,
        plantilla: PLANTILLA.DIRECCION_DEPOSITO,
        datos: {
          nombre: admin.fullName.split(' ')[0] ?? admin.fullName,
          quien: admin.id === autor?.id ? 'Tú' : (autor?.fullName ?? 'Un administrador'),
          accion: datos.accion,
          verbo: datos.verbo,
          red: datos.red,
          direccion: datos.direccion,
          fecha: fechaLegible(new Date()),
          ...(datos.activa ? { activa: datos.activa } : {}),
        },
        clave: `${datos.clave}:${admin.id}`,
      });
    }
  }

  private async guardarAjuste(m: EntityManager, clave: string, valor: unknown, quien: Quien) {
    await m.query(
      `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [clave, JSON.stringify(valor), quien.sesion.usuarioId],
    );
  }

  private registrar(
    m: EntityManager,
    { sesion, cliente }: Quien,
    accion: string,
    tipo: string,
    metadata: Record<string, unknown>,
    id: string | null = null,
  ) {
    return this.auditoria.registrar(
      {
        actorId: sesion.usuarioId,
        actorRole: sesion.rol,
        action: accion,
        targetType: tipo,
        targetId: id,
        metadata,
        ip: cliente.ip,
        userAgent: cliente.userAgent ?? null,
      },
      m,
    );
  }
}
