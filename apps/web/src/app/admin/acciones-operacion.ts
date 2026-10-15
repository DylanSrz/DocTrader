'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { llamarApi, type RespuestaApi } from '@/lib/api';
import { texto } from '@/lib/formulario';
import { ETIQUETA_LANDING } from '@/lib/publico';
import { tokenDeSesion } from '@/lib/sesion';

/**
 * Acciones de la operación diaria del admin: cuentas, licencias y ajustes. Las delicadas (ver contraseñas, exportar,
 * precios, direcciones) se intentan primero sin código: si la confirmación de los últimos 5 minutos sigue vigente,
 * pasan; si no, la API pide confirmar y el formulario muestra el campo del código de la app.
 */

export interface EstadoOperacion {
  error?: string;
  campos?: Record<string, string>;
  /** Cambia en cada acción exitosa (cerrar el panel lateral, avisar). */
  listo?: number;
  aviso?: string;
  /** La API pidió confirmar con el código de la app. */
  pideCodigo?: boolean;
}

async function token(): Promise<string> {
  const t = await tokenDeSesion();
  if (!t) redirect('/ingresar');
  return t;
}

type Resultado<T> = { ok: true; datos: T } | { ok: false; estado: EstadoOperacion };

async function operar<T>(
  datos: FormData,
  llamada: (t: string) => Promise<RespuestaApi<T>>,
): Promise<Resultado<T>> {
  const t = await token();
  const codigo = texto(datos, 'codigo').replace(/\s/g, '');
  if (codigo) {
    const confirmacion = await llamarApi('/auth/confirmar', {
      metodo: 'POST',
      cuerpo: { codigo },
      token: t,
    });
    if (!confirmacion.ok) {
      return { ok: false, estado: { error: confirmacion.error.mensaje, pideCodigo: true } };
    }
  }
  const respuesta = await llamada(t);
  if (respuesta.ok) return { ok: true, datos: respuesta.datos };
  if (respuesta.error.codigo === 'CONFIRMACION_REQUERIDA') {
    return { ok: false, estado: { pideCodigo: true } };
  }
  return {
    ok: false,
    estado: { error: respuesta.error.mensaje, campos: respuesta.error.campos },
  };
}

function listo(previo: EstadoOperacion, aviso: string): EstadoOperacion {
  return { listo: (previo.listo ?? 0) + 1, aviso };
}

/** "1.500", "1500", "1,500.50" → centavos. `null` si está vacío; `NaN` si no es un monto. */
function centavos(valor: string): number | null {
  const limpio = valor.replace(/\s|USD|\$/gi, '');
  if (!limpio) return null;
  // Separador de miles con punto (como se escribe en Colombia) y decimales opcionales con coma.
  const normal = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)
    ? limpio.replaceAll('.', '').replace(',', '.')
    : limpio.replaceAll(',', '');
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Math.round(Number(normal) * 100) : Number.NaN;
}

function entero(valor: string): number {
  return /^\s*\d+\s*$/.test(valor) ? Number(valor) : Number.NaN;
}

// ── Cuentas ─────────────────────────────────────────────────────────────────────────────────────────

export interface EstadoContrasenas extends EstadoOperacion {
  contrasenas?: { operativa: string; inversor: string };
  /** Hasta cuándo se muestran (60 segundos, `docs/SEGURIDAD.md` §4.3). */
  hasta?: number;
}

export async function verContrasenas(
  previo: EstadoContrasenas,
  datos: FormData,
): Promise<EstadoContrasenas> {
  const id = texto(datos, 'cuenta');
  const r = await operar<{ operativa: string; inversor: string }>(datos, (t) =>
    llamarApi(`/admin/cuentas/${encodeURIComponent(id)}/contrasenas`, { metodo: 'POST', token: t }),
  );
  if (!r.ok) return r.estado;
  return { listo: (previo.listo ?? 0) + 1, contrasenas: r.datos, hasta: Date.now() + 60_000 };
}

export async function marcarConectada(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'cuenta');
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/cuentas/${encodeURIComponent(id)}/conectada`, { metodo: 'POST', token: t }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(previo, `Cuenta ${texto(datos, 'numero')} conectada. Le avisamos al cliente.`);
}

export async function marcarDesconectada(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'cuenta');
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/cuentas/${encodeURIComponent(id)}/desconectada`, {
      metodo: 'POST',
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(previo, `Cuenta ${texto(datos, 'numero')} desconectada.`);
}

/** Capital y riesgo (y las notas, si el formulario las trae). */
export async function guardarAsignacion(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'cuenta');
  const capital = centavos(texto(datos, 'capital'));
  if (Number.isNaN(capital)) {
    return { campos: { capitalUsdCentavos: 'Escribe el capital en dólares, por ejemplo 1.500.' } };
  }
  const cuerpo: Record<string, unknown> = {
    capitalUsdCentavos: capital,
    riesgo: texto(datos, 'riesgo') || null,
  };
  if (datos.has('notas')) cuerpo.notas = texto(datos, 'notas');
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/cuentas/${encodeURIComponent(id)}/asignacion`, {
      metodo: 'PUT',
      cuerpo,
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(previo, 'Datos guardados.');
}

// ── Licencias ───────────────────────────────────────────────────────────────────────────────────────

export interface EstadoCedula extends EstadoOperacion {
  cedula?: string;
}

export async function verCedula(previo: EstadoCedula, datos: FormData): Promise<EstadoCedula> {
  const id = texto(datos, 'cliente');
  const r = await operar<{ cedula: string }>(datos, (t) =>
    llamarApi(`/admin/clientes/${encodeURIComponent(id)}/cedula`, { metodo: 'POST', token: t }),
  );
  if (!r.ok) return r.estado;
  return { listo: (previo.listo ?? 0) + 1, cedula: r.datos.cedula };
}

export async function extenderLicencia(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'licencia');
  const dias = entero(texto(datos, 'dias'));
  if (Number.isNaN(dias)) return { campos: { dias: 'Escribe cuántos días, solo el número.' } };
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/licencias/${encodeURIComponent(id)}/extender`, {
      metodo: 'POST',
      cuerpo: { dias, motivo: texto(datos, 'motivo').trim() },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(
    previo,
    dias === 1
      ? 'Sumamos 1 día. Le avisamos al cliente.'
      : `Sumamos ${dias} días. Le avisamos al cliente.`,
  );
}

export async function suspenderLicencia(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'licencia');
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/licencias/${encodeURIComponent(id)}/suspender`, {
      metodo: 'POST',
      cuerpo: { motivo: texto(datos, 'motivo').trim() },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(previo, 'Licencia suspendida. La cuenta pasó a por desconectar.');
}

export async function reactivarLicencia(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'licencia');
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/licencias/${encodeURIComponent(id)}/reactivar`, {
      metodo: 'POST',
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin', 'layout');
  return listo(previo, 'Licencia reactivada.');
}

export interface EstadoExportacion extends EstadoOperacion {
  csv?: string;
  nombre?: string;
}

/** La lista de licencias en CSV (con el filtro y la búsqueda de la vista). El navegador la descarga. */
export async function exportarLicencias(
  previo: EstadoExportacion,
  datos: FormData,
): Promise<EstadoExportacion> {
  const parametros = new URLSearchParams();
  const filtro = texto(datos, 'filtro');
  const q = texto(datos, 'q');
  if (filtro) parametros.set('filtro', filtro);
  if (q) parametros.set('q', q);
  const r = await operar<string>(datos, (t) =>
    llamarApi(`/admin/licencias.csv?${parametros}`, { token: t, texto: true }),
  );
  if (!r.ok) return r.estado;
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    listo: (previo.listo ?? 0) + 1,
    csv: r.datos,
    nombre: `licencias-${filtro || 'todas'}-${hoy}.csv`,
  };
}

// ── Ajustes ─────────────────────────────────────────────────────────────────────────────────────────

export async function guardarPrecios(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const precios = {
    MENSUAL: centavos(texto(datos, 'MENSUAL')),
    SEMESTRAL: centavos(texto(datos, 'SEMESTRAL')),
    PRUEBA: centavos(texto(datos, 'PRUEBA')),
  };
  const malos = Object.entries(precios).filter(([, v]) => v === null || Number.isNaN(v));
  if (malos.length > 0) {
    return {
      pideCodigo: Boolean(texto(datos, 'codigo')),
      campos: Object.fromEntries(malos.map(([k]) => [k, 'Escribe el precio en dólares.'])),
    };
  }
  const r = await operar(datos, (t) =>
    llamarApi('/admin/ajustes/precios', {
      metodo: 'PUT',
      cuerpo: { ...precios, diasPrueba: entero(texto(datos, 'diasPrueba')) },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  updateTag(ETIQUETA_LANDING);
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Precios guardados. Aplican a las órdenes nuevas.');
}

export async function guardarOperacion(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const r = await operar(datos, (t) =>
    llamarApi('/admin/ajustes/operacion', {
      metodo: 'PUT',
      cuerpo: {
        diasGracia: entero(texto(datos, 'diasGracia')),
        minutosOrden: entero(texto(datos, 'minutosOrden')),
        confirmacionesTron: entero(texto(datos, 'confirmacionesTron')),
        confirmacionesBitcoin: entero(texto(datos, 'confirmacionesBitcoin')),
      },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Ajustes guardados.');
}

export async function guardarEnlaces(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const r = await operar(datos, (t) =>
    llamarApi('/admin/ajustes/enlaces', {
      metodo: 'PUT',
      cuerpo: {
        telegram: texto(datos, 'telegram').trim(),
        instagram: texto(datos, 'instagram').trim(),
        brokerNombre: texto(datos, 'brokerNombre').trim(),
        brokerUrl: texto(datos, 'brokerUrl').trim(),
        correoSoporte: texto(datos, 'correoSoporte').trim(),
      },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  updateTag(ETIQUETA_LANDING);
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Enlaces guardados. La página ya los muestra.');
}

export async function guardarMyfxbook(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const opcional = (campo: string) => texto(datos, campo).trim().replace(',', '.') || null;
  const r = await operar(datos, (t) =>
    llamarApi('/admin/ajustes/myfxbook', {
      metodo: 'PUT',
      cuerpo: {
        url: texto(datos, 'url').trim(),
        ganancia: opcional('ganancia'),
        caidaMaxima: opcional('caidaMaxima'),
        auditadaDesde: opcional('auditadaDesde'),
        alDia: opcional('alDia'),
      },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  updateTag(ETIQUETA_LANDING);
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Cifras guardadas. La página ya las muestra.');
}

export async function agregarDireccion(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const r = await operar(datos, (t) =>
    llamarApi('/admin/direcciones', {
      metodo: 'POST',
      cuerpo: { moneda: texto(datos, 'moneda'), direccion: texto(datos, 'direccion').trim() },
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin/ajustes');
  return listo(previo, 'Dirección agregada. Se activa en 24 horas; les avisamos a los dos admins.');
}

/** Cancelar, desactivar o reactivar una dirección. */
export async function cambiarDireccion(
  previo: EstadoOperacion,
  datos: FormData,
): Promise<EstadoOperacion> {
  const id = texto(datos, 'direccion');
  const accion = texto(datos, 'accion');
  if (!['cancelar', 'desactivar', 'reactivar'].includes(accion))
    return { error: 'Acción no válida.' };
  const r = await operar(datos, (t) =>
    llamarApi(`/admin/direcciones/${encodeURIComponent(id)}/${accion}`, {
      metodo: 'POST',
      token: t,
    }),
  );
  if (!r.ok) return r.estado;
  revalidatePath('/admin/ajustes');
  const aviso = {
    cancelar: 'Dirección cancelada. No se va a activar.',
    desactivar: 'Dirección desactivada. Las órdenes nuevas ya no la usan.',
    reactivar: 'Dirección reactivada.',
  }[accion as 'cancelar' | 'desactivar' | 'reactivar'];
  return listo(previo, aviso);
}
