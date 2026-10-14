import { hash, verify } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';

/** Parámetros de Argon2id recomendados por OWASP (19 MiB, 2 pasadas). */
// `algorithm: 2` es Argon2id (el enum de la librería no se puede importar con `isolatedModules`).
const OPCIONES = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/**
 * Hash de relleno: cuando el correo no existe se verifica contra él, para que la respuesta tarde lo mismo y no
 * delate qué correos están registrados.
 */
const HASH_DE_RELLENO = hash('contraseña-de-relleno-que-nunca-coincide', OPCIONES);

@Injectable()
export class ContrasenasService {
  private readonly logger = new Logger(ContrasenasService.name);
  private readonly revisarFiltradas: boolean;

  constructor(config: ConfigService<Entorno, true>) {
    this.revisarFiltradas = config.get('HIBP_ACTIVO', { infer: true });
  }

  crearHash(contrasena: string): Promise<string> {
    return hash(contrasena, OPCIONES);
  }

  async coincide(hashGuardado: string | null, contrasena: string): Promise<boolean> {
    try {
      return await verify(hashGuardado ?? (await HASH_DE_RELLENO), contrasena);
    } catch {
      return false;
    }
  }

  /**
   * ¿La contraseña aparece en filtraciones conocidas? Consulta Have I Been Pwned por rango: solo salen los 5
   * primeros caracteres del SHA-1, nunca la contraseña. Si el servicio no responde, no bloquea el registro.
   */
  async estaFiltrada(contrasena: string): Promise<boolean> {
    if (!this.revisarFiltradas) return false;
    const sha1 = createHash('sha1').update(contrasena).digest('hex').toUpperCase();
    const prefijo = sha1.slice(0, 5);
    const sufijo = sha1.slice(5);
    try {
      const respuesta = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'DocTraderPRO' },
        signal: AbortSignal.timeout(3_000),
      });
      if (!respuesta.ok) throw new Error(`HIBP respondió ${respuesta.status}`);
      const lista = await respuesta.text();
      return lista.split('\n').some((linea) => {
        const [resto, veces] = linea.trim().split(':');
        return resto === sufijo && Number(veces) > 0;
      });
    } catch (error) {
      this.logger.warn(`No se pudo revisar la contraseña en HIBP: ${(error as Error).message}`);
      return false;
    }
  }
}
