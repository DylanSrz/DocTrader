import { timingSafeEqual } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { Entorno } from '../config/entorno.js';
import { ENCABEZADO_AGENTE, ENCABEZADO_IP, ENCABEZADO_SECRETO, type Peticion } from './contexto.js';

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * La API solo atiende al servidor de la web (que guarda la sesión en una cookie de su propio dominio). La web
 * firma cada petición con `PROXY_SECRET` y reenvía la IP y el navegador del cliente. Sin el secreto, la API
 * responde 404, como si no existiera. `/salud` queda abierta para el monitor.
 */
@Injectable()
export class WebMiddleware implements NestMiddleware {
  private readonly secreto: string | undefined;

  constructor(config: ConfigService<Entorno, true>) {
    this.secreto = config.get('PROXY_SECRET', { infer: true });
  }

  use(peticion: Peticion, respuesta: Response, siguiente: NextFunction): void {
    const recibido = peticion.headers[ENCABEZADO_SECRETO];
    const deLaWeb =
      this.secreto !== undefined && typeof recibido === 'string' && iguales(recibido, this.secreto);

    if (this.secreto !== undefined && !deLaWeb && peticion.path !== '/salud') {
      respuesta.status(404).json({ codigo: 'NO_ENCONTRADO', mensaje: 'No encontrado.' });
      return;
    }

    const ip = peticion.headers[ENCABEZADO_IP];
    const agente = peticion.headers[ENCABEZADO_AGENTE];
    peticion.ipCliente =
      deLaWeb && typeof ip === 'string' && ip ? ip.slice(0, 64) : (peticion.ip ?? '');
    peticion.agenteCliente =
      deLaWeb && typeof agente === 'string'
        ? agente.slice(0, 400)
        : peticion.headers['user-agent']?.slice(0, 400);
    siguiente();
  }
}
