import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { reportarError } from '../monitoreo/sentry.js';

const MENSAJES: Partial<Record<number, { codigo: string; mensaje: string }>> = {
  [HttpStatus.NOT_FOUND]: { codigo: 'NO_ENCONTRADO', mensaje: 'No encontrado.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    codigo: 'DEMASIADO_GRANDE',
    mensaje: 'La petición es demasiado grande.',
  },
};

/**
 * Todas las respuestas de error tienen la misma forma: `{ codigo, mensaje }`, que la web sabe mostrar. Los
 * errores inesperados se registran con su detalle (en los registros de Railway y, si está activo, en Sentry) y al
 * cliente solo le llega un mensaje genérico.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const estado = error.getStatus();
      const cuerpo = error.getResponse();
      if (typeof cuerpo === 'object' && cuerpo !== null && 'codigo' in cuerpo) {
        respuesta.status(estado).json(cuerpo);
        return;
      }
      respuesta
        .status(estado)
        .json(MENSAJES[estado] ?? { codigo: 'ERROR', mensaje: 'La petición no es válida.' });
      return;
    }
    const peticion = host.switchToHttp().getRequest<{ method?: string; path?: string }>();
    this.logger.error(
      `${peticion.method} ${peticion.path}: ${(error as Error)?.message}`,
      (error as Error)?.stack,
    );
    reportarError(error, { ruta: `${peticion.method} ${peticion.path}` });
    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.',
    });
  }
}
