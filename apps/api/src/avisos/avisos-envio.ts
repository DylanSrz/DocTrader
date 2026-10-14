import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { Entorno } from '../config/entorno.js';
import { ESTADO_AVISO } from '../database/entidades/index.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { CONTEXTO_SECRETO_AVISO } from './avisos.service.js';
import { renderizar } from './plantillas.js';
import { consola, mailpit, type ProveedorCorreo, resend } from './proveedor-correo.js';

const LOTE = 20;
const MAXIMO_INTENTOS = 8;

interface FilaAviso {
  id: string;
  recipient: string;
  template: string;
  payload: Record<string, string>;
  secret_enc: Buffer | null;
  attempts: number;
}

/**
 * Envía los correos pendientes de `notifications`. Cada fila se "reserva" por 5 minutos antes de enviarla, así
 * dos workers nunca envían la misma; si el envío falla, se reintenta con espera creciente hasta 8 veces.
 */
@Injectable()
export class AvisosEnvio {
  private readonly logger = new Logger(AvisosEnvio.name);
  private readonly proveedor: ProveedorCorreo | null;
  private readonly web: string;
  private readonly remitente: { de: string; responderA: string };

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly cifrado: CifradoService,
    config: ConfigService<Entorno, true>,
  ) {
    const llaveResend = config.get('RESEND_API_KEY', { infer: true });
    const urlMailpit = config.get('MAILPIT_URL', { infer: true });
    const produccion = config.get('NODE_ENV', { infer: true }) === 'production';
    this.proveedor = llaveResend
      ? resend(llaveResend)
      : urlMailpit
        ? mailpit(urlMailpit)
        : produccion
          ? null
          : consola((m) => this.logger.log(m));
    if (!this.proveedor) {
      this.logger.warn('Sin RESEND_API_KEY: los correos quedan en cola hasta que se configure');
    }
    this.web = config.get('WEB_ORIGIN', { infer: true });
    this.remitente = {
      de: config.get('MAIL_FROM', { infer: true }),
      responderA: config.get('MAIL_REPLY_TO', { infer: true }),
    };
  }

  /** Envía un lote. Devuelve cuántos correos salieron. */
  async enviarPendientes(): Promise<number> {
    if (!this.proveedor) return 0;
    const filas = (await this.fuente.query(
      `UPDATE notifications SET next_attempt_at = now() + interval '5 minutes', attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM notifications
         WHERE status = 'PENDIENTE' AND channel = 'EMAIL' AND next_attempt_at <= now()
         ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       RETURNING id, recipient, template, payload, secret_enc, attempts`,
      [LOTE],
    )) as [FilaAviso[], number];

    let enviados = 0;
    for (const fila of filas[0]) {
      try {
        const secreto = fila.secret_enc
          ? this.cifrado.descifrar(fila.secret_enc, CONTEXTO_SECRETO_AVISO)
          : null;
        const correo = renderizar(fila.template, fila.payload, secreto, this.web);
        const idProveedor = await this.proveedor.enviar(
          fila.id,
          fila.recipient,
          correo,
          this.remitente,
        );
        await this.fuente.query(
          `UPDATE notifications SET status = $2, sent_at = now(), provider_message_id = $3,
             secret_enc = NULL, last_error = NULL WHERE id = $1`,
          [fila.id, ESTADO_AVISO.ENVIADA, idProveedor],
        );
        enviados++;
      } catch (error) {
        const mensaje = (error as Error).message.slice(0, 500);
        const agotado = fila.attempts >= MAXIMO_INTENTOS;
        this.logger.warn(
          `No se pudo enviar el aviso ${fila.id} (intento ${fila.attempts}): ${mensaje}`,
        );
        await this.fuente.query(
          `UPDATE notifications SET last_error = $2,
             status = CASE WHEN $3 THEN 'FALLIDA' ELSE status END,
             secret_enc = CASE WHEN $3 THEN NULL ELSE secret_enc END,
             next_attempt_at = now() + make_interval(secs => $4)
           WHERE id = $1`,
          [fila.id, mensaje, agotado, 30 * 2 ** fila.attempts],
        );
      }
    }
    return enviados;
  }
}
