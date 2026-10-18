import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';

/** Llaves secretas de prueba de Cloudflare (siempre pasan, siempre fallan…): https://developers.cloudflare.com/turnstile/troubleshooting/testing/ */
const LLAVE_DE_PRUEBA = /^[123]x0+AA$/;

/** Verifica del lado del servidor el desafío de Cloudflare Turnstile (`docs/SEGURIDAD.md` §9). */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secreto: string | undefined;
  /** Dominios donde se puede resolver el desafío: el de la web (con y sin `www`). */
  private readonly dominios: Set<string>;

  constructor(config: ConfigService<Entorno, true>) {
    this.secreto = config.get('TURNSTILE_SECRET', { infer: true });
    if (!this.secreto) this.logger.warn('Turnstile desactivado: falta TURNSTILE_SECRET');
    const web = new URL(config.get('WEB_ORIGIN', { infer: true })).hostname;
    const raiz = web.replace(/^www\./, '');
    this.dominios = new Set([web, raiz, `www.${raiz}`]);
  }

  get activo(): boolean {
    return Boolean(this.secreto);
  }

  /**
   * Sin secreto configurado, siempre pasa. Si Cloudflare no responde, no pasa: es mejor reintentar que dejar bots.
   * Como recomienda Cloudflare, además de `success` se revisa que el desafío se haya resuelto en la web de la
   * plataforma (`hostname`). Las llaves de prueba de Cloudflare responden con otro dominio: con ellas no se revisa.
   */
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
      const resultado = (await respuesta.json()) as {
        success?: boolean;
        hostname?: string;
        'error-codes'?: string[];
      };
      if (resultado.success !== true) {
        this.logger.warn(
          `Turnstile rechazó un token: ${(resultado['error-codes'] ?? []).join(', ')}`,
        );
        return false;
      }
      if (!LLAVE_DE_PRUEBA.test(this.secreto) && !this.dominios.has(resultado.hostname ?? '')) {
        this.logger.warn(
          `Turnstile resuelto en otro dominio: ${resultado.hostname ?? '(ninguno)'}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Turnstile no respondió: ${(error as Error).message}`);
      return false;
    }
  }
}
