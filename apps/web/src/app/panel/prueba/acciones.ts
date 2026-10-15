'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';

/** Estado de los formularios de la prueba: el SMS, el código y la solicitud. */
export interface EstadoPrueba {
  /** Cambia en cada envío: vuelve a montar el desafío de Turnstile (cada respuesta sirve una vez). */
  envio?: number;
  /** El SMS salió: se muestra el campo del código. */
  enviado?: boolean;
  error?: string;
  campos?: Record<string, string>;
  /** La solicitud quedó bloqueada: lo que coincidió con una prueba anterior. */
  motivos?: string[];
}

async function token(): Promise<string> {
  const t = await tokenDeSesion();
  if (!t) redirect('/ingresar');
  return t;
}

export async function enviarCodigo(previo: EstadoPrueba, datos: FormData): Promise<EstadoPrueba> {
  const envio = (previo.envio ?? 0) + 1;
  const r = await llamarApi('/prueba/telefono/codigo', {
    metodo: 'POST',
    cuerpo: { turnstile: texto(datos, 'turnstile') || undefined },
    token: await token(),
  });
  if (!r.ok) return { envio, error: r.error.mensaje, enviado: previo.enviado };
  return { envio, enviado: true };
}

export async function verificarCodigo(
  previo: EstadoPrueba,
  datos: FormData,
): Promise<EstadoPrueba> {
  const r = await llamarApi('/prueba/telefono/verificar', {
    metodo: 'POST',
    cuerpo: { codigo: texto(datos, 'codigo').replace(/\s/g, '') },
    token: await token(),
  });
  if (!r.ok) {
    return {
      envio: previo.envio,
      enviado: true,
      error: r.error.campos ? undefined : r.error.mensaje,
      campos: r.error.campos,
    };
  }
  revalidatePath('/panel', 'layout');
  return { envio: previo.envio, enviado: false };
}

export async function solicitarPrueba(
  previo: EstadoPrueba,
  datos: FormData,
): Promise<EstadoPrueba> {
  const cuentaId = texto(datos, 'cuentaId');
  if (!cuentaId) return { campos: { cuentaId: 'Elige la cuenta de trading para la prueba.' } };
  const r = await llamarApi<{ estado: string; motivos: string[] }>('/prueba/solicitud', {
    metodo: 'POST',
    cuerpo: { cuentaId },
    token: await token(),
  });
  if (!r.ok) return { error: r.error.mensaje, campos: r.error.campos };
  revalidatePath('/panel', 'layout');
  return r.datos.estado === 'BLOQUEADA' ? { motivos: r.datos.motivos } : {};
}
