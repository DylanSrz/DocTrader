'use server';

import type { PreguntaFrecuente, TipoDocumentoLegal } from '@doctrader/shared';
import { revalidatePath, updateTag } from 'next/cache';
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

export interface EstadoPago {
  error?: string;
  /** Cambia en cada acción exitosa, para cerrar el panel lateral y avisar. */
  listo?: number;
  aviso?: string;
}

/** Aprobar un pago. `forzar` es "aprobar de todos modos" (no pasó la verificación y el admin lo revisó). */
export async function aprobarPago(previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const numero = texto(datos, 'numero');
  const respuesta = await llamarApi(`/admin/pagos/${encodeURIComponent(numero)}/aprobar`, {
    metodo: 'POST',
    cuerpo: { forzar: datos.get('forzar') === 'si' },
    token: await token(),
  });
  if (!respuesta.ok) return { error: respuesta.error.mensaje };
  revalidatePath('/admin', 'layout');
  return {
    listo: (previo.listo ?? 0) + 1,
    aviso: `Pago ${numero} aprobado. La licencia ya está activa.`,
  };
}

const MOTIVOS: Record<string, string> = {
  monto: 'El monto que llegó no está completo.',
  red: 'El pago se envió por otra red o en otra moneda.',
  hash: 'No encontramos la transacción en la blockchain.',
  otro: '',
};

/** Rechazar un pago con un motivo, que le llega al cliente por correo. */
export async function rechazarPago(previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const numero = texto(datos, 'numero');
  const detalle = texto(datos, 'detalle').trim();
  const motivo = [MOTIVOS[texto(datos, 'motivo')] ?? '', detalle].filter(Boolean).join(' ');
  if (motivo.length < 5) return { error: 'Escribe el motivo: le llega al cliente por correo.' };
  const respuesta = await llamarApi(`/admin/pagos/${encodeURIComponent(numero)}/rechazar`, {
    metodo: 'POST',
    cuerpo: { motivo: motivo.slice(0, 500) },
    token: await token(),
  });
  if (!respuesta.ok) {
    return { error: respuesta.error.campos?.motivo ?? respuesta.error.mensaje };
  }
  revalidatePath('/admin', 'layout');
  return {
    listo: (previo.listo ?? 0) + 1,
    aviso: `Pago ${numero} rechazado. Le avisamos al cliente.`,
  };
}

/** Volver a mirar la blockchain ahora. */
export async function verificarPago(previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const numero = texto(datos, 'numero');
  const respuesta = await llamarApi(`/admin/pagos/${encodeURIComponent(numero)}/verificar`, {
    metodo: 'POST',
    token: await token(),
  });
  if (!respuesta.ok) return { error: respuesta.error.mensaje };
  revalidatePath('/admin/pagos');
  return { listo: (previo.listo ?? 0) + 1, aviso: 'Verificación actualizada.' };
}

/**
 * Encender o apagar la aprobación automática. Encenderla es delicado: primero se confirma con el código de la app.
 */
export async function cambiarAprobacionAutomatica(
  previo: EstadoPago,
  datos: FormData,
): Promise<EstadoPago> {
  const t = await token();
  const activa = datos.get('activa') === 'si';
  if (activa) {
    const confirmacion = await llamarApi('/auth/confirmar', {
      metodo: 'POST',
      cuerpo: { codigo: texto(datos, 'codigo').trim() },
      token: t,
    });
    if (!confirmacion.ok) return { error: confirmacion.error.mensaje };
  }
  const respuesta = await llamarApi('/admin/pagos/aprobacion-automatica', {
    metodo: 'PUT',
    cuerpo: { activa },
    token: t,
  });
  if (!respuesta.ok) return { error: respuesta.error.mensaje };
  revalidatePath('/admin/pagos');
  return {
    listo: (previo.listo ?? 0) + 1,
    aviso: activa ? 'Aprobación automática encendida.' : 'Aprobación automática apagada.',
  };
}
