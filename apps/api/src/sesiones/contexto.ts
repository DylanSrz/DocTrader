import type { Request } from 'express';
import type { SesionActiva } from './sesiones.service.js';

/** La petición, con lo que agregan el middleware de la web y la guarda de sesión. */
export interface Peticion extends Request {
  /** IP real del cliente: la que manda la web (si trae el secreto) o la del proxy de Railway. */
  ipCliente: string;
  /** User agent del navegador del cliente (la web lo reenvía). */
  agenteCliente: string | undefined;
  sesion?: SesionActiva;
}

export const ENCABEZADO_SECRETO = 'x-doctrader-proxy';
export const ENCABEZADO_IP = 'x-doctrader-ip';
export const ENCABEZADO_AGENTE = 'x-doctrader-agente';
