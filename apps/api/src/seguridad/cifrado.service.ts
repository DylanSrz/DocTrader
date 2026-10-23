import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';
import { cifrar, descifrar, huella, llavesDeCifrado } from './cifrado.js';

/**
 * Cifrado por campo con la llave actual. Para rotarla (`docs/ROTACION-CREDENCIALES.md`): la llave nueva entra con la
 * versión siguiente y la vieja como `DATA_ENCRYPTION_KEY_ANTERIOR`; lo nuevo se cifra con la nueva, lo viejo se sigue
 * leyendo y el paso previo al despliegue lo vuelve a cifrar. Después se quita la anterior.
 */
@Injectable()
export class CifradoService {
  private readonly version: number;
  private readonly llaves: Map<number, Buffer>;
  private readonly llaveBusqueda: Buffer;

  constructor(config: ConfigService<Entorno, true>) {
    ({ version: this.version, llaves: this.llaves } = llavesDeCifrado({
      DATA_ENCRYPTION_KEY: config.get('DATA_ENCRYPTION_KEY', { infer: true }),
      DATA_ENCRYPTION_KEY_VERSION: config.get('DATA_ENCRYPTION_KEY_VERSION', { infer: true }),
      DATA_ENCRYPTION_KEY_ANTERIOR: config.get('DATA_ENCRYPTION_KEY_ANTERIOR', { infer: true }),
    }));
    this.llaveBusqueda = Buffer.from(config.get('LOOKUP_HMAC_KEY', { infer: true }), 'base64');
  }

  cifrar(texto: string, contexto: string): Buffer {
    return cifrar(this.llaves.get(this.version)!, this.version, texto, contexto);
  }

  descifrar(dato: Buffer, contexto: string): string {
    return descifrar(this.llaves, dato, contexto).toString('utf8');
  }

  /** Huella para buscar sin descifrar: cédulas repetidas, enlaces de un solo uso, sesiones, dispositivos. */
  huella(proposito: string, valor: string): Buffer {
    return huella(this.llaveBusqueda, proposito, valor);
  }
}
