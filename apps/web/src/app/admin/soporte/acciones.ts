'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi, type RespuestaApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';
import type { EstadoOperacion } from '../acciones-operacion';

/** Acciones de soporte del admin. Ninguna pide el código de la app: no tocan dinero ni datos delicados. */

export interface EstadoSoporteAdmin extends EstadoOperacion {
  /** Lo que se escribió, para no borrarlo si hay un error. */
  valores?: Record<string, string>;
}

async function llamar<T>(
  ruta: string,
  opciones: { metodo: 'POST' | 'PUT' | 'DELETE'; cuerpo?: unknown },
): Promise<RespuestaApi<T>> {
  const token = await tokenDeSesion();
  if (!token) redirect('/ingresar');
  return llamarApi<T>(ruta, { ...opciones, token });
}

function fallo(r: Extract<RespuestaApi<unknown>, { ok: false }>, previo: EstadoSoporteAdmin) {
  return {
    error: r.error.campos ? undefined : r.error.mensaje,
    campos: r.error.campos,
    listo: previo.listo,
  };
}

function listo(previo: EstadoSoporteAdmin, aviso: string): EstadoSoporteAdmin {
  return { listo: (previo.listo ?? 0) + 1, aviso };
}

function refrescar() {
  // La pestaña Soporte y "Hoy" cuentan los tickets sin responder.
  revalidatePath('/admin', 'layout');
}

export async function responderTicketAdmin(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const numero = texto(datos, 'numero');
  const mensaje = texto(datos, 'mensaje');
  const interna = texto(datos, 'interna') === 'on';
  const adjuntos = datos
    .getAll('adjuntos')
    .filter((v): v is string => typeof v === 'string' && !!v);
  const r = await llamar(`/admin/soporte/${encodeURIComponent(numero)}/mensajes`, {
    metodo: 'POST',
    cuerpo: { mensaje, interna, adjuntos },
  });
  if (!r.ok) return { ...fallo(r, previo), valores: { mensaje, interna: interna ? 'on' : '' } };
  refrescar();
  return listo(
    previo,
    interna ? 'Nota interna guardada.' : 'Respuesta enviada. Al cliente le llega por correo.',
  );
}

export async function resolverTicketAdmin(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const r = await llamar(`/admin/soporte/${encodeURIComponent(texto(datos, 'numero'))}/resolver`, {
    metodo: 'POST',
  });
  if (!r.ok) return fallo(r, previo);
  refrescar();
  return listo(previo, 'Ticket resuelto. Se cierra solo si el cliente no vuelve a escribir.');
}

/** Asignación y prioridad: se guardan apenas cambian. */
export async function cambiarTicket(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const asignado = texto(datos, 'asignadoA');
  const r = await llamar(`/admin/soporte/${encodeURIComponent(texto(datos, 'numero'))}`, {
    metodo: 'PUT',
    cuerpo: { asignadoA: asignado || null, prioridad: texto(datos, 'prioridad') },
  });
  if (!r.ok) return fallo(r, previo);
  refrescar();
  return listo(previo, 'Ticket actualizado.');
}

/** Crea una respuesta guardada o, con `id`, la edita. */
export async function guardarRespuesta(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const id = texto(datos, 'id');
  const valores = { titulo: texto(datos, 'titulo'), cuerpo: texto(datos, 'cuerpo') };
  const r = await llamar(id ? `/admin/respuestas/${encodeURIComponent(id)}` : '/admin/respuestas', {
    metodo: id ? 'PUT' : 'POST',
    cuerpo: valores,
  });
  if (!r.ok) return { ...fallo(r, previo), valores };
  revalidatePath('/admin/respuestas');
  return listo(previo, id ? 'Respuesta guardada.' : 'Respuesta agregada.');
}

export async function borrarRespuesta(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const r = await llamar(`/admin/respuestas/${encodeURIComponent(texto(datos, 'id'))}`, {
    metodo: 'DELETE',
  });
  if (!r.ok) return fallo(r, previo);
  revalidatePath('/admin/respuestas');
  return listo(previo, 'Respuesta borrada.');
}

export async function guardarSoporte(
  previo: EstadoSoporteAdmin,
  datos: FormData,
): Promise<EstadoSoporteAdmin> {
  const crudo = texto(datos, 'diasCierre');
  const r = await llamar('/admin/ajustes/soporte', {
    metodo: 'PUT',
    cuerpo: { diasCierre: /^\s*\d+\s*$/.test(crudo) ? Number(crudo) : crudo },
  });
  if (!r.ok) return fallo(r, previo);
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Ajuste guardado.');
}
