'use server';

import { formaDireccionTron } from '@doctrader/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { obtenerSesion, tokenDeSesion } from '@/lib/sesion';

/** Estado del formulario de la dirección de cobro (cliente y socio). */
export interface EstadoDireccion {
  error?: string;
  campos?: Record<string, string>;
  /** Cambia en cada envío exitoso, para avisar. */
  listo?: number;
  aviso?: string;
  /** La API pidió confirmar la identidad: con el código de la app o, sin segundo factor, con la contraseña. */
  pide?: 'codigo' | 'contrasena';
  valores?: Record<string, string>;
}

/**
 * Registra o cambia la dirección USDT (Tron) donde se cobran las comisiones. Es dinero: la API exige haber
 * confirmado la identidad hace menos de 5 minutos. Si no, el formulario pide el código o la contraseña y se repite.
 */
export async function guardarDireccion(
  previo: EstadoDireccion,
  datos: FormData,
): Promise<EstadoDireccion> {
  const token = await tokenDeSesion();
  const sesion = await obtenerSesion();
  if (!token || !sesion) redirect('/ingresar');
  const direccion = texto(datos, 'direccion').trim();
  const valores = { direccion };
  if (!formaDireccionTron(direccion)) {
    return {
      campos: {
        direccion:
          'Copia la dirección de tu billetera para USDT en la red Tron (TRC20): empieza por T y tiene 34 caracteres.',
      },
      valores,
      pide: previo.pide,
    };
  }

  const codigo = texto(datos, 'codigo').replace(/\s/g, '');
  const contrasena = texto(datos, 'contrasena');
  if (codigo || contrasena) {
    const confirmacion = await llamarApi('/auth/confirmar', {
      metodo: 'POST',
      cuerpo: codigo ? { codigo } : { contrasena },
      token,
    });
    if (!confirmacion.ok) {
      return { error: confirmacion.error.mensaje, pide: previo.pide, valores };
    }
  }
  const r = await llamarApi('/referidos/mio/direccion', {
    metodo: 'PUT',
    cuerpo: { direccion },
    token,
  });
  if (!r.ok) {
    if (r.estado === 401) redirect('/ingresar');
    if (r.error.codigo === 'CONFIRMACION_REQUERIDA') {
      return { pide: sesion.usuario.segundoFactor ? 'codigo' : 'contrasena', valores };
    }
    return { error: r.error.campos ? undefined : r.error.mensaje, campos: r.error.campos, valores };
  }
  revalidatePath(sesion.usuario.rol === 'ADMIN' ? '/admin/socio' : '/panel/referidos');
  return { listo: (previo.listo ?? 0) + 1, aviso: 'Dirección de cobro guardada' };
}
