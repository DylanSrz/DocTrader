'use server';

import type { PreguntaFrecuente, TipoDocumentoLegal } from '@doctrader/shared';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { ETIQUETA_LANDING, ETIQUETA_LEGAL } from '@/lib/publico';
import { tokenDeSesion } from '@/lib/sesion';

export interface EstadoGuardado {
  /** Cambia en cada guardado exitoso, para mostrar "Guardado" sin perder lo escrito. */
  guardado?: number;
  error?: string;
  campos?: Record<string, string>;
}

async function token(): Promise<string> {
  const t = await tokenDeSesion();
  if (!t) redirect('/ingresar');
  return t;
}

/** Guarda las preguntas frecuentes y vuelve a armar la landing con ellas. */
export async function guardarPreguntas(
  previo: EstadoGuardado,
  preguntas: PreguntaFrecuente[],
): Promise<EstadoGuardado> {
  const respuesta = await llamarApi('/admin/preguntas', {
    metodo: 'PUT',
    cuerpo: { preguntas },
    token: await token(),
  });
  if (!respuesta.ok) {
    const campos = respuesta.error.campos;
    return {
      error: campos ? Object.values(campos)[0] : respuesta.error.mensaje,
    };
  }
  updateTag(ETIQUETA_LANDING);
  return { guardado: (previo.guardado ?? 0) + 1 };
}

export interface EstadoPublicacion {
  error?: string;
  publicada?: number;
}

/**
 * Publica una versión nueva de un texto legal. Primero confirma con el código de la app (acción delicada) y
 * luego publica; la página pública se vuelve a armar con el texto nuevo.
 */
export async function publicarLegal(
  _previo: EstadoPublicacion,
  datos: FormData,
): Promise<EstadoPublicacion> {
  const t = await token();
  const tipo = texto(datos, 'tipo') as TipoDocumentoLegal;
  const confirmacion = await llamarApi('/auth/confirmar', {
    metodo: 'POST',
    cuerpo: { codigo: texto(datos, 'codigo').trim() },
    token: t,
  });
  if (!confirmacion.ok) return { error: confirmacion.error.mensaje };
  const respuesta = await llamarApi<{ version: number }>(`/admin/legal/${tipo}`, {
    metodo: 'POST',
    cuerpo: { contenido: texto(datos, 'contenido') },
    token: t,
  });
  if (!respuesta.ok) {
    return { error: respuesta.error.campos?.contenido ?? respuesta.error.mensaje };
  }
  updateTag(ETIQUETA_LEGAL);
  return { publicada: respuesta.datos.version };
}
