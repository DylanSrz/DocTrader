'use server';

import { llamarApi } from '@/lib/api';
import { tokenDeSesion } from '@/lib/sesion';

export type PermisoSubida =
  | { ok: true; url: string; ficha: string; porMensaje: number; maximoBytes: number }
  | { ok: false; error: string };

/**
 * Permiso para que el navegador suba adjuntos directo a la API: los archivos de hasta 10 MB no caben por las
 * funciones de Vercel (4,5 MB). La API da una ficha de 30 minutos ligada a la sesión de quien la pide.
 */
export async function pedirPermisoSubida(): Promise<PermisoSubida> {
  const token = await tokenDeSesion();
  if (!token) return { ok: false, error: 'Tu sesión terminó. Ingresa de nuevo.' };
  const r = await llamarApi<{ ficha: string; porMensaje: number; maximoBytes: number }>(
    '/archivos/permiso',
    { metodo: 'POST', token },
  );
  if (!r.ok) return { ok: false, error: r.error.mensaje };
  return { ok: true, url: new URL('/archivos/subir', process.env.API_URL).toString(), ...r.datos };
}
