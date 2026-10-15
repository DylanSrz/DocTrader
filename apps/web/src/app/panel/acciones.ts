'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi, type ErrorApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';

/** Estado de los formularios del panel del cliente. */
export interface EstadoPanel {
  /** Cambia en cada envío exitoso: el formulario cierra el panel lateral y avisa. */
  listo?: number;
  /** Lo que se le dice a la persona al terminar ("Datos guardados"). */
  aviso?: string;
  mensaje?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

async function token(): Promise<string> {
  const t = await tokenDeSesion();
  if (!t) redirect('/ingresar');
  return t;
}

function desdeError(
  error: ErrorApi,
  estado: number,
  valores?: Record<string, string>,
): EstadoPanel {
  if (estado === 401) redirect('/ingresar');
  return error.campos
    ? { campos: error.campos, valores, mensaje: 'Revisa los datos marcados.' }
    : { mensaje: error.mensaje, valores };
}

const CAMPOS_CUENTA = ['titular', 'broker', 'servidor', 'numero'] as const;

function datosCuenta(datos: FormData) {
  const valores = Object.fromEntries(
    CAMPOS_CUENTA.map((c) => [c, texto(datos, c).trim()]),
  ) as Record<(typeof CAMPOS_CUENTA)[number], string>;
  return {
    valores,
    contrasenaOperativa: texto(datos, 'contrasenaOperativa'),
    contrasenaInversor: texto(datos, 'contrasenaInversor'),
  };
}

/** Lo que se revisa antes de llamar a la API, para no hacer esperar a la persona por un campo vacío. */
function revisarCuenta(
  valores: Record<string, string>,
  contrasenas: { operativa: string; inversor: string; obligatorias: boolean },
) {
  const campos: Record<string, string> = {};
  if (valores.titular!.length < 3)
    campos.titular = 'Escribe el nombre del titular como aparece en tu broker.';
  if (valores.broker!.length < 2) campos.broker = 'Escribe el nombre de tu broker.';
  if (valores.servidor!.length < 3) campos.servidor = 'Escribe el servidor de tu cuenta.';
  if (!/^\d{4,16}$/.test(valores.numero!)) campos.numero = 'Escribe solo los números de tu cuenta.';
  if (contrasenas.obligatorias || contrasenas.operativa) {
    if (contrasenas.operativa.length < 4)
      campos.contrasenaOperativa =
        'Escribe la contraseña operativa (la de operar, no la de inversor).';
  }
  if (contrasenas.obligatorias || contrasenas.inversor) {
    if (contrasenas.inversor.length < 4)
      campos.contrasenaInversor = 'Escribe la contraseña de inversor (solo lectura).';
  }
  return campos;
}

/** Agrega la cuenta y crea la orden de su licencia (en USDT; en Pagos se puede cambiar a BTC). */
export async function agregarCuenta(previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const t = await token();
  const { valores, contrasenaOperativa, contrasenaInversor } = datosCuenta(datos);
  const plan = texto(datos, 'plan');
  const campos = revisarCuenta(valores, {
    operativa: contrasenaOperativa,
    inversor: contrasenaInversor,
    obligatorias: true,
  });
  if (Object.keys(campos).length > 0) {
    return { campos, valores: { ...valores, plan }, mensaje: 'Revisa los datos marcados.' };
  }
  const cuenta = await llamarApi<{ id: string }>('/cuentas', {
    metodo: 'POST',
    cuerpo: { ...valores, contrasenaOperativa, contrasenaInversor },
    token: t,
  });
  if (!cuenta.ok) return desdeError(cuenta.error, cuenta.estado, { ...valores, plan });

  const orden = await llamarApi<{ numero: string }>('/ordenes', {
    metodo: 'POST',
    cuerpo: { cuentaId: cuenta.datos.id, plan, moneda: 'USDT' },
    token: t,
  });
  revalidatePath('/panel', 'layout');
  if (!orden.ok) {
    return {
      listo: (previo.listo ?? 0) + 1,
      aviso: `Guardamos la cuenta, pero no pudimos crear la orden: ${orden.error.mensaje}`,
    };
  }
  redirect(`/panel/pagos?orden=${orden.datos.numero}`);
}

export async function editarCuenta(previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const t = await token();
  const id = texto(datos, 'id');
  const { valores, contrasenaOperativa, contrasenaInversor } = datosCuenta(datos);
  const campos = revisarCuenta(valores, {
    operativa: contrasenaOperativa,
    inversor: contrasenaInversor,
    obligatorias: false,
  });
  if (Object.keys(campos).length > 0) {
    return { campos, valores, mensaje: 'Revisa los datos marcados.' };
  }
  const respuesta = await llamarApi(`/cuentas/${encodeURIComponent(id)}`, {
    metodo: 'PUT',
    cuerpo: {
      ...valores,
      contrasenaOperativa: contrasenaOperativa || undefined,
      contrasenaInversor: contrasenaInversor || undefined,
    },
    token: t,
  });
  if (!respuesta.ok) return desdeError(respuesta.error, respuesta.estado, valores);
  revalidatePath('/panel', 'layout');
  return { listo: (previo.listo ?? 0) + 1, aviso: 'Datos de la cuenta guardados.' };
}

export async function quitarCuenta(previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const respuesta = await llamarApi(`/cuentas/${encodeURIComponent(texto(datos, 'id'))}`, {
    metodo: 'DELETE',
    token: await token(),
  });
  if (!respuesta.ok) return desdeError(respuesta.error, respuesta.estado);
  revalidatePath('/panel', 'layout');
  return { listo: (previo.listo ?? 0) + 1, aviso: 'Quitamos la cuenta.' };
}

/** Crea una orden (comprar, renovar, cambiar de plan o de moneda) y lleva a pagarla. */
export async function crearOrden(_previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const respuesta = await llamarApi<{ numero: string }>('/ordenes', {
    metodo: 'POST',
    cuerpo: {
      cuentaId: texto(datos, 'cuentaId'),
      plan: texto(datos, 'plan'),
      moneda: texto(datos, 'moneda') || 'USDT',
    },
    token: await token(),
  });
  if (!respuesta.ok) return desdeError(respuesta.error, respuesta.estado);
  revalidatePath('/panel', 'layout');
  redirect(`/panel/pagos?orden=${respuesta.datos.numero}`);
}

export async function reportarPago(previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const numero = texto(datos, 'numero');
  const hash = texto(datos, 'hash').trim();
  if (hash.length < 40) {
    return {
      campos: { hash: 'Pega el código completo de la transacción: son 64 letras y números.' },
      valores: { hash },
    };
  }
  const respuesta = await llamarApi(`/ordenes/${encodeURIComponent(numero)}/reportar`, {
    metodo: 'POST',
    cuerpo: { hash },
    token: await token(),
  });
  if (!respuesta.ok) return desdeError(respuesta.error, respuesta.estado, { hash });
  revalidatePath('/panel', 'layout');
  return { listo: (previo.listo ?? 0) + 1, aviso: 'Pago reportado.' };
}

export async function cancelarOrden(_previo: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const numero = texto(datos, 'numero');
  const respuesta = await llamarApi(`/ordenes/${encodeURIComponent(numero)}/cancelar`, {
    metodo: 'POST',
    token: await token(),
  });
  if (!respuesta.ok) return desdeError(respuesta.error, respuesta.estado);
  revalidatePath('/panel', 'layout');
  redirect('/panel');
}
