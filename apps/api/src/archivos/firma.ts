import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';

/**
 * Fichas firmadas y de corta vida para lo que el navegador hace directo con la API, sin pasar por la web: subir un
 * adjunto (los archivos de 10 MB no caben por las funciones de Vercel) y, en desarrollo, descargarlo. La llave sale
 * de `LOOKUP_HMAC_KEY` con un propósito propio, así una ficha no sirve para nada más.
 */
@Injectable()
export class FirmaArchivos {
  private readonly llave: Buffer;

  constructor(config: ConfigService<Entorno, true>) {
    this.llave = createHmac(
      'sha256',
      Buffer.from(config.get('LOOKUP_HMAC_KEY', { infer: true }), 'base64'),
    )
      .update('archivos:v1')
      .digest();
  }

  private sello(proposito: string, cuerpo: string): Buffer {
    return createHmac('sha256', this.llave).update(`${proposito}.${cuerpo}`).digest();
  }

  firmar(proposito: string, datos: Record<string, string>, segundos: number): string {
    const cuerpo = Buffer.from(
      JSON.stringify({ ...datos, exp: Math.floor(Date.now() / 1000) + segundos }),
    ).toString('base64url');
    return `${cuerpo}.${this.sello(proposito, cuerpo).toString('base64url')}`;
  }

  /** Los datos de la ficha, o `null` si no es de este propósito, fue alterada o ya venció. */
  leer(proposito: string, ficha: string): Record<string, string> | null {
    const [cuerpo, firma, sobra] = ficha.split('.');
    if (!cuerpo || !firma || sobra !== undefined) return null;
    const esperada = this.sello(proposito, cuerpo);
    const recibida = Buffer.from(firma, 'base64url');
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
    try {
      const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      if (typeof datos.exp !== 'number' || datos.exp < Date.now() / 1000) return null;
      return Object.fromEntries(
        Object.entries(datos).filter((e): e is [string, string] => typeof e[1] === 'string'),
      );
    } catch {
      return null;
    }
  }
}
