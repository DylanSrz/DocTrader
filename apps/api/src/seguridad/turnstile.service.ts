import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';

/** Verifica del lado del servidor el desafío de Cloudflare Turnstile (`docs/SEGURIDAD.md` §9). */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secreto: string | undefined;

  constructor(config: ConfigService<Entorno, true>) {
    this.secreto = config.get('TURNSTILE_SECRET', { infer: true });
    if (!this.secreto) this.logger.warn('Turnstile desactivado: falta TURNSTILE_SECRET');
  }

  get activo(): boolean {
    return Boolean(this.secreto);
  }

  /** Sin secreto configurado, siempre pasa. Si Cloudflare no responde, no pasa: es mejor reintentar que dejar bots. */
  async valido(token: string | undefined, ip: string): Promise<boolean> {
    if (!this.secreto) return true;
    if (!token) return false;
    try {
      const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: this.secreto, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5_000),
      });
      const resultado = (await respuesta.json()) as { success?: boolean };
      return resultado.success === true;
    } catch (error) {
      this.logger.warn(`Turnstile no respondió: ${(error as Error).message}`);
      return false;
    }
  }
}
