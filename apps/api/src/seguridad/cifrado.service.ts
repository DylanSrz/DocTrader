import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';
import { cifrar, descifrar, huella } from './cifrado.js';

/**
 * Versión de la llave actual. Para rotarla: se agrega la llave nueva como versión 2, se cifra todo lo nuevo con
 * ella, se vuelven a cifrar los datos viejos con un trabajo del worker y solo entonces se retira la versión 1.
 */
const VERSION_ACTUAL = 1;

@Injectable()
export class CifradoService {
  private readonly llaves: Map<number, Buffer>;
  private readonly llaveBusqueda: Buffer;

  constructor(config: ConfigService<Entorno, true>) {
    this.llaves = new Map([
      [VERSION_ACTUAL, Buffer.from(config.get('DATA_ENCRYPTION_KEY', { infer: true }), 'base64')],
    ]);
    this.llaveBusqueda = Buffer.from(config.get('LOOKUP_HMAC_KEY', { infer: true }), 'base64');
  }

  cifrar(texto: string, contexto: string): Buffer {
    return cifrar(this.llaves.get(VERSION_ACTUAL)!, VERSION_ACTUAL, texto, contexto);
  }

  descifrar(dato: Buffer, contexto: string): string {
    return descifrar(this.llaves, dato, contexto).toString('utf8');
  }

  /** Huella para buscar sin descifrar: cédulas repetidas, enlaces de un solo uso, sesiones, dispositivos. */
  huella(proposito: string, valor: string): Buffer {
    return huella(this.llaveBusqueda, proposito, valor);
  }
}
