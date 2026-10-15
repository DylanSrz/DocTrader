'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';

/** Estado de los formularios de soporte del cliente. */
export interface EstadoSoporte {
  error?: string;
  campos?: Record<string, string>;
  /** Lo que la persona escribió, para no borrarlo si hay un error. */
  valores?: Record<string, string>;
  /** Cambia en cada envío exitoso: limpia el formulario y los adjuntos. */
  listo?: number;
}

async function token(): Promise<string> {
  const t = await tokenDeSesion();
  if (!t) redirect('/ingresar');
  return t;
}

function adjuntos(datos: FormData): string[] {
  return datos.getAll('adjuntos').filter((v): v is string => typeof v === 'string' && v !== '');
}

/** Abre el ticket y lleva a su hilo. */
export async function crearTicket(_previo: EstadoSoporte, datos: FormData): Promise<EstadoSoporte> {
  const valores = {
    tema: texto(datos, 'tema'),
    relacion: texto(datos, 'relacion'),
    asunto: texto(datos, 'asunto'),
    mensaje: texto(datos, 'mensaje'),
  };
  // La relación es "cuenta:<id>" u "orden:<id>".
  const [tipo, id] = valores.relacion.split(':');
  const r = await llamarApi<{ numero: number }>('/soporte', {
    metodo: 'POST',
    token: await token(),
    cuerpo: {
      tema: valores.tema,
      asunto: valores.asunto,
      mensaje: valores.mensaje,
      cuentaId: tipo === 'cuenta' ? id : undefined,
      ordenId: tipo === 'orden' ? id : undefined,
      adjuntos: adjuntos(datos),
    },
  });
  if (!r.ok) {
    const campos = r.error.campos
      ? Object.fromEntries(
          Object.entries(r.error.campos).map(([c, m]) => [
            c === 'cuentaId' || c === 'ordenId' ? 'relacion' : c,
            m,
          ]),
        )
      : undefined;
    return { error: campos ? undefined : r.error.mensaje, campos, valores };
  }
  revalidatePath('/panel/soporte');
  redirect(`/panel/soporte?ticket=${r.datos.numero}`);
}

export async function responderTicket(
  previo: EstadoSoporte,
  datos: FormData,
): Promise<EstadoSoporte> {
  const numero = texto(datos, 'numero');
  const mensaje = texto(datos, 'mensaje');
  const r = await llamarApi(`/soporte/${encodeURIComponent(numero)}/mensajes`, {
    metodo: 'POST',
    token: await token(),
    cuerpo: { mensaje, adjuntos: adjuntos(datos) },
  });
  if (!r.ok) {
    return {
      error: r.error.campos ? undefined : r.error.mensaje,
      campos: r.error.campos,
      valores: { mensaje },
      listo: previo.listo,
    };
  }
  revalidatePath('/panel', 'layout');
  return { listo: (previo.listo ?? 0) + 1 };
}

/** "Mi problema ya se resolvió". */
export async function resolverTicket(
  previo: EstadoSoporte,
  datos: FormData,
): Promise<EstadoSoporte> {
  const numero = texto(datos, 'numero');
  const r = await llamarApi(`/soporte/${encodeURIComponent(numero)}/resolver`, {
    metodo: 'POST',
    token: await token(),
  });
  if (!r.ok) return { error: r.error.mensaje, listo: previo.listo };
  revalidatePath('/panel', 'layout');
  return { listo: (previo.listo ?? 0) + 1 };
}
