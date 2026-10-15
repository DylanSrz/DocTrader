import type { EstadoSesion, Rol } from '@doctrader/shared';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Peticion } from './contexto.js';

export const PUBLICA = 'publica';
export const ESTADOS_PERMITIDOS = 'estadosPermitidos';
export const ROLES = 'roles';
export const CONFIRMACION_RECIENTE = 'confirmacionReciente';

/** Ruta sin sesión (registro, ingreso, recuperar contraseña). Todo lo demás exige sesión. */
export const Publica = () => SetMetadata(PUBLICA, true);

/**
 * Estados de sesión aceptados además de `COMPLETA`. Por defecto una sesión a medias (sin el código del segundo
 * factor) no sirve para nada salvo terminar el ingreso.
 */
export const PermitirEstados = (...estados: EstadoSesion[]) =>
  SetMetadata(ESTADOS_PERMITIDOS, estados);

/** Solo para estos roles. Sin este decorador, cualquier usuario con sesión completa puede entrar. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** Acción delicada: exige haber confirmado la identidad hace menos de 5 minutos (`docs/SEGURIDAD.md` §3). */
export const ConfirmacionReciente = () => SetMetadata(CONFIRMACION_RECIENTE, true);

/** La sesión de la petición. Solo en rutas que no son públicas. */
export const SesionActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext) =>
    contexto.switchToHttp().getRequest<Peticion>().sesion!,
);

/** IP y navegador del cliente, para auditoría, límites y avisos. */
export const Cliente = createParamDecorator((_dato: unknown, contexto: ExecutionContext) => {
  const peticion = contexto.switchToHttp().getRequest<Peticion>();
  return { ip: peticion.ipCliente, userAgent: peticion.agenteCliente };
});
