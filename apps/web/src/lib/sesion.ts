import 'server-only';
import type { EstadoSesion, Rol } from '@doctrader/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { llamarApi } from './api';
import { COOKIE_SESION } from './cookies';

export interface Sesion {
  estado: EstadoSesion;
  expiraEn: number;
  confirmadaHasta: number;
  usuario: { id: string; nombre: string; correo: string; rol: Rol; segundoFactor: boolean };
}

/** El token de la sesión, si el navegador tiene la cookie. */
export async function tokenDeSesion(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESION)?.value;
}

/** La sesión actual según la API (una sola consulta por petición). `null` si no hay o ya terminó. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const token = await tokenDeSesion();
  if (!token) return null;
  const respuesta = await llamarApi<Sesion>('/auth/sesion', { token });
  return respuesta.ok ? respuesta.datos : null;
});

/** A dónde va cada quien después de ingresar. */
export function inicioDe(rol: Rol): string {
  return rol === 'ADMIN' ? '/admin' : '/panel';
}

/**
 * Exige una sesión completa (y un rol, si se pide). Si no la hay, lleva a donde corresponda: ingresar, terminar el
 * segundo factor o el panel propio. La API vuelve a revisar todo en cada petición: esto es solo para la vista.
 */
export async function requerirSesion(rol?: Rol): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.estado === 'SEGUNDO_FACTOR_PENDIENTE') redirect('/ingresar');
  if (sesion.estado === 'SEGUNDO_FACTOR_POR_CONFIGURAR') redirect('/segundo-factor');
  if (rol && sesion.usuario.rol !== rol) redirect(inicioDe(sesion.usuario.rol));
  return sesion;
}
