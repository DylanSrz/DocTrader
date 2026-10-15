import { ESTADO_SESION, type EstadoSesion, ROL, type Rol } from '@doctrader/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { secretoAleatorio } from '../seguridad/cifrado.js';
import { describirNavegador } from './navegador.js';

const MINUTO = 60;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Duraciones de `docs/SEGURIDAD.md` §3, en segundos. */
export const DURACION_SESION: Record<Rol, { inactividad: number; maximo: number }> = {
  [ROL.ADMIN]: { inactividad: 30 * MINUTO, maximo: 8 * HORA },
  [ROL.CLIENTE]: { inactividad: 7 * DIA, maximo: 30 * DIA },
};
/** Una sesión a medias (falta el código del segundo factor) dura poco. */
const MAXIMO_SESION_A_MEDIAS = 15 * MINUTO;
/** La confirmación reciente para acciones delicadas vale 5 minutos. */
export const DURACION_CONFIRMACION = 5 * MINUTO;
/** Intentos de código del segundo factor antes de cerrar la sesión a medias. */
export const MAXIMO_INTENTOS_CODIGO = 5;

export interface DatosSesion {
  id: string;
  usuarioId: string;
  rol: Rol;
  estado: EstadoSesion;
  /** Fechas en milisegundos desde 1970. */
  creadaEn: number;
  ultimaActividad: number;
  expiraEn: number;
  confirmadaHasta: number;
  intentosCodigo: number;
  ip: string;
  navegador: string;
  /** Huella del identificador del navegador, para registrar el dispositivo al terminar el ingreso. */
  dispositivo: string | null;
}

export interface SesionActiva extends DatosSesion {
  /** Huella del token (clave en Redis). Nunca sale de la API. */
  huella: string;
}

export interface ContextoCliente {
  ip: string;
  userAgent: string | undefined;
}

/**
 * Sesiones del lado del servidor, en Redis (`docs/SEGURIDAD.md` §3). El navegador solo tiene un token aleatorio
 * (en una cookie de la web); Redis guarda la huella del token, así quien lea Redis no puede usar las sesiones.
 * Cerrar una sesión es borrar su clave: el efecto es inmediato.
 */
@Injectable()
export class SesionesService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly cifrado: CifradoService,
  ) {}

  private clave(huella: string) {
    return `sesion:${huella}`;
  }

  private indice(usuarioId: string) {
    return `usuario:${usuarioId}:sesiones`;
  }

  private huellaDe(token: string): string {
    return this.cifrado.huella('sesion', token).toString('base64url');
  }

  private ttl(datos: DatosSesion, ahora: number): number {
    const restante = Math.floor((datos.expiraEn - ahora) / 1000);
    const inactividad =
      datos.estado === ESTADO_SESION.COMPLETA
        ? DURACION_SESION[datos.rol].inactividad
        : MAXIMO_SESION_A_MEDIAS;
    return Math.min(restante, inactividad);
  }

  async crear(
    usuario: { id: string; role: Rol },
    estado: EstadoSesion,
    cliente: ContextoCliente,
    dispositivo: string | null = null,
  ): Promise<{ token: string; sesion: SesionActiva }> {
    const ahora = Date.now();
    const maximo =
      estado === ESTADO_SESION.COMPLETA
        ? DURACION_SESION[usuario.role].maximo
        : MAXIMO_SESION_A_MEDIAS;
    const token = secretoAleatorio();
    const huella = this.huellaDe(token);
    const datos: DatosSesion = {
      id: secretoAleatorio(12),
      usuarioId: usuario.id,
      rol: usuario.role,
      estado,
      creadaEn: ahora,
      ultimaActividad: ahora,
      expiraEn: ahora + maximo * 1000,
      confirmadaHasta: 0,
      intentosCodigo: 0,
      ip: cliente.ip,
      navegador: describirNavegador(cliente.userAgent),
      dispositivo,
    };
    await this.redis
      .multi()
      .set(this.clave(huella), JSON.stringify(datos), 'EX', this.ttl(datos, ahora))
      .hset(this.indice(usuario.id), datos.id, huella)
      .expire(this.indice(usuario.id), DURACION_SESION[ROL.CLIENTE].maximo)
      .exec();
    return { token, sesion: { ...datos, huella } };
  }

  /** Busca la sesión del token y, si existe, renueva su tiempo de inactividad. */
  async obtener(token: string): Promise<SesionActiva | null> {
    if (!token || token.length > 100) return null;
    const huella = this.huellaDe(token);
    const guardado = await this.redis.get(this.clave(huella));
    if (!guardado) return null;
    const datos = JSON.parse(guardado) as DatosSesion;
    const ahora = Date.now();
    if (datos.expiraEn <= ahora) {
      await this.cerrar({ ...datos, huella });
      return null;
    }
    datos.ultimaActividad = ahora;
    await this.redis.set(this.clave(huella), JSON.stringify(datos), 'EX', this.ttl(datos, ahora));
    return { ...datos, huella };
  }

  /** Guarda cambios de una sesión (estado, confirmación, intentos) sin alargar su vida máxima. */
  async guardar(sesion: SesionActiva): Promise<void> {
    const { huella, ...datos } = sesion;
    const ttl = this.ttl(datos, Date.now());
    if (ttl <= 0) return this.cerrar(sesion);
    // XX: si la sesión se cerró mientras tanto, no se revive.
    await this.redis.set(this.clave(huella), JSON.stringify(datos), 'EX', ttl, 'XX');
  }

  async cerrar(sesion: Pick<SesionActiva, 'huella' | 'usuarioId' | 'id'>): Promise<void> {
    await this.redis
      .multi()
      .del(this.clave(sesion.huella))
      .hdel(this.indice(sesion.usuarioId), sesion.id)
      .exec();
  }

  /** Cierra todas las sesiones de un usuario (al cambiar la contraseña o el segundo factor), salvo `excepto`. */
  async cerrarTodas(usuarioId: string, excepto?: string): Promise<void> {
    const todas = await this.redis.hgetall(this.indice(usuarioId));
    const cerrar = Object.entries(todas).filter(([id]) => id !== excepto);
    if (cerrar.length === 0) return;
    await this.redis
      .multi()
      .del(...cerrar.map(([, huella]) => this.clave(huella)))
      .hdel(this.indice(usuarioId), ...cerrar.map(([id]) => id))
      .exec();
  }

  async listar(usuarioId: string): Promise<DatosSesion[]> {
    const todas = await this.redis.hgetall(this.indice(usuarioId));
    const entradas = Object.entries(todas);
    if (entradas.length === 0) return [];
    const valores = await this.redis.mget(...entradas.map(([, huella]) => this.clave(huella)));
    const vencidas = entradas.filter((_, i) => !valores[i]).map(([id]) => id);
    if (vencidas.length > 0) await this.redis.hdel(this.indice(usuarioId), ...vencidas);
    return valores
      .filter((valor): valor is string => Boolean(valor))
      .map((valor) => JSON.parse(valor) as DatosSesion)
      .filter((datos) => datos.estado === ESTADO_SESION.COMPLETA)
      .sort((a, b) => b.ultimaActividad - a.ultimaActividad);
  }

  async cerrarPorId(usuarioId: string, id: string): Promise<boolean> {
    const huella = await this.redis.hget(this.indice(usuarioId), id);
    if (!huella) return false;
    await this.cerrar({ huella, usuarioId, id });
    return true;
  }
}
