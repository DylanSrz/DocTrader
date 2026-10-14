'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { llamarApi } from '@/lib/api';
import { borrarSesion } from '@/lib/cookies';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';

/** Cierra la sesión en la API (al instante) y borra la cookie. */
export async function salir(): Promise<void> {
  const token = await tokenDeSesion();
  if (token) await llamarApi('/auth/salir', { metodo: 'POST', token });
  await borrarSesion();
  redirect('/ingresar');
}

export async function cerrarSesion(datos: FormData): Promise<void> {
  const token = await tokenDeSesion();
  const id = texto(datos, 'id');
  if (token && /^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    await llamarApi(`/auth/sesiones/${id}`, { metodo: 'DELETE', token });
  }
  revalidatePath('/', 'layout');
}

export async function cerrarOtrasSesiones(): Promise<void> {
  const token = await tokenDeSesion();
  if (token) await llamarApi('/auth/sesiones/cerrar-otras', { metodo: 'POST', token });
  revalidatePath('/', 'layout');
}

export interface EstadoCodigos {
  error?: string;
  codigos?: string[];
}

/**
 * Códigos de recuperación nuevos: es una acción delicada, así que primero se confirma con el código de la app
 * (confirmación reciente de `docs/SEGURIDAD.md` §3) y luego se generan.
 */
export async function regenerarCodigos(
  _previo: EstadoCodigos,
  datos: FormData,
): Promise<EstadoCodigos> {
  const token = await tokenDeSesion();
  if (!token) redirect('/ingresar');
  const confirmacion = await llamarApi('/auth/confirmar', {
    metodo: 'POST',
    cuerpo: { codigo: texto(datos, 'codigo').trim() },
    token,
  });
  if (!confirmacion.ok) return { error: confirmacion.error.mensaje };
  const respuesta = await llamarApi<{ codigos: string[] }>('/auth/segundo-factor/codigos', {
    metodo: 'POST',
    token,
  });
  if (!respuesta.ok) return { error: respuesta.error.mensaje };
  return { codigos: respuesta.datos.codigos };
}
