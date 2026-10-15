import { ESTADO_SESION, type EstadoSesion, type Rol } from '@doctrader/shared';
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errorApi } from '../seguridad/errores.js';
import type { Peticion } from './contexto.js';
import { CONFIRMACION_RECIENTE, ESTADOS_PERMITIDOS, PUBLICA, ROLES } from './decoradores.js';
import { SesionesService } from './sesiones.service.js';

/**
 * Guarda global: toda ruta exige sesión salvo las marcadas `@Publica()`. Revisa además el estado de la sesión,
 * el rol y, en acciones delicadas, la confirmación reciente.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionesService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    const peticion = contexto.switchToHttp().getRequest<Peticion>();
    const publica = this.reflector.getAllAndOverride<boolean>(PUBLICA, destinos);

    const token = /^Bearer (.+)$/.exec(peticion.headers.authorization ?? '')?.[1];
    const sesion = token ? await this.sesiones.obtener(token) : null;
    if (sesion) peticion.sesion = sesion;
    if (publica) return true;

    if (!sesion) {
      throw errorApi(HttpStatus.UNAUTHORIZED, 'SIN_SESION', 'Tu sesión terminó. Ingresa de nuevo.');
    }

    const permitidos = this.reflector.getAllAndOverride<EstadoSesion[]>(
      ESTADOS_PERMITIDOS,
      destinos,
    );
    if (sesion.estado !== ESTADO_SESION.COMPLETA && !permitidos?.includes(sesion.estado)) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        sesion.estado,
        sesion.estado === ESTADO_SESION.SEGUNDO_FACTOR_PENDIENTE
          ? 'Escribe el código de tu app de autenticación para terminar de ingresar.'
          : 'Configura el segundo factor para poder usar el panel.',
      );
    }

    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES, destinos);
    if (roles && !roles.includes(sesion.rol)) {
      throw errorApi(HttpStatus.FORBIDDEN, 'SIN_PERMISO', 'No tienes permiso para ver esto.');
    }

    const confirmar = this.reflector.getAllAndOverride<boolean>(CONFIRMACION_RECIENTE, destinos);
    if (confirmar && sesion.confirmadaHasta <= Date.now()) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        'CONFIRMACION_REQUERIDA',
        'Por seguridad, confirma que eres tú antes de continuar.',
      );
    }
    return true;
  }
}
