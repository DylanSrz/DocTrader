import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { errorApi } from './errores.js';

export interface Regla {
  /** Nombre corto de la regla, parte de la clave en Redis. */
  nombre: string;
  /** Intentos permitidos en la ventana. */
  maximo: number;
  /** Duración de la ventana, en segundos. */
  ventana: number;
}

/** Límites de velocidad de `docs/SEGURIDAD.md` §2 y §9, con ventanas fijas en Redis (compartidas entre réplicas). */
export const LIMITES = {
  global: { nombre: 'global', maximo: 600, ventana: 300 },
  ingresoPorIp: { nombre: 'ingreso-ip', maximo: 30, ventana: 900 },
  registroPorIp: { nombre: 'registro-ip', maximo: 5, ventana: 3_600 },
  correoPorIp: { nombre: 'correo-ip', maximo: 10, ventana: 3_600 },
  correoPorCuenta: { nombre: 'correo-cuenta', maximo: 3, ventana: 3_600 },
  enlacePorIp: { nombre: 'enlace-ip', maximo: 20, ventana: 3_600 },
  confirmarPorUsuario: { nombre: 'confirmar', maximo: 5, ventana: 900 },
  cuentasPorUsuario: { nombre: 'cuentas', maximo: 30, ventana: 3_600 },
  ordenesPorUsuario: { nombre: 'ordenes', maximo: 30, ventana: 3_600 },
  reportesPorUsuario: { nombre: 'reportes', maximo: 10, ventana: 3_600 },
  subidasPorUsuario: { nombre: 'subidas', maximo: 40, ventana: 3_600 },
  ticketsPorUsuario: { nombre: 'tickets', maximo: 10, ventana: 3_600 },
  mensajesPorUsuario: { nombre: 'mensajes-ticket', maximo: 60, ventana: 3_600 },
  descargasPorUsuario: { nombre: 'mis-datos', maximo: 5, ventana: 3_600 },
  // "Te invitó: …" en el registro: un código se adivina solo probando miles, y esto lo hace inútil.
  codigoReferidoPorIp: { nombre: 'codigo-referido', maximo: 60, ventana: 3_600 },
  direccionCobroPorUsuario: { nombre: 'direccion-cobro', maximo: 5, ventana: 86_400 },
} satisfies Record<string, Regla>;

@Injectable()
export class LimitesService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Cuenta un intento. Devuelve cuántos segundos faltan para poder reintentar, o 0 si está permitido. */
  async consumir(regla: Regla, clave: string): Promise<number> {
    const llave = `limite:${regla.nombre}:${clave}`;
    const resultado = await this.redis
      .multi()
      .set(llave, 0, 'EX', regla.ventana, 'NX')
      .incr(llave)
      .ttl(llave)
      .exec();
    const intentos = Number(resultado?.[1]?.[1] ?? 0);
    const ttl = Number(resultado?.[2]?.[1] ?? regla.ventana);
    return intentos > regla.maximo ? Math.max(ttl, 1) : 0;
  }

  /** Igual que `consumir`, pero si se pasó del límite responde 429 con el tiempo de espera. */
  async exigir(regla: Regla, clave: string): Promise<void> {
    const espera = await this.consumir(regla, clave);
    if (espera > 0) throw demasiadosIntentos(espera);
  }
}

export function demasiadosIntentos(segundos: number) {
  const minutos = Math.ceil(segundos / 60);
  return errorApi(
    HttpStatus.TOO_MANY_REQUESTS,
    'DEMASIADOS_INTENTOS',
    `Demasiados intentos. Intenta de nuevo en ${minutos === 1 ? '1 minuto' : `${minutos} minutos`}.`,
    { reintentarEn: segundos },
  );
}
