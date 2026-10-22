import 'server-only';
import { DIAS_COOKIE_REFERIDO, normalizarCodigo } from '@doctrader/shared';
import { cookies } from 'next/headers';
import { llamarApi } from './api';

/** Programa de referidos en la web: la cookie del enlace, la invitación del registro y las vistas de la API. */

export const SITIO = process.env.SITIO_URL ?? 'https://www.doctraderpro.com';
const COOKIE = 'ref';
const produccion = process.env.NODE_ENV === 'production';

/** El enlace que comparte quien refiere. */
export const enlaceDeReferido = (codigo: string) => `${SITIO}/r/${codigo}`;

/** Guarda el código del enlace por 30 días. Si alguien abre otro enlace, gana el último. */
export async function recordarCodigo(codigo: string): Promise<void> {
  (await cookies()).set(COOKIE, codigo, {
    httpOnly: true,
    secure: produccion,
    sameSite: 'lax',
    path: '/',
    maxAge: DIAS_COOKIE_REFERIDO * 24 * 60 * 60,
  });
}

export async function codigoGuardado(): Promise<string | null> {
  return normalizarCodigo((await cookies()).get(COOKIE)?.value);
}

export async function olvidarCodigo(): Promise<void> {
  const almacen = await cookies();
  if (almacen.has(COOKIE)) almacen.delete(COOKIE);
}

/** "Ana M.", si el código sirve hoy (existe y su dueño puede referir); si no, `null`. */
export async function invitacion(codigo: string | null): Promise<string | null> {
  if (!codigo) return null;
  const r = await llamarApi<{ nombre: string }>(`/referidos/codigo/${encodeURIComponent(codigo)}`);
  return r.ok ? r.datos.nombre : null;
}

/** Lo que devuelve `GET /referidos/mio`. */
export interface VistaReferidos {
  programa: {
    activo: boolean;
    porcentajeBp: number;
    segundaLineaBp: number;
    minimoPagoUsdCents: number;
    esperaHoras: number;
  };
  puedeReferir: boolean;
  via: 'HABILITADO' | 'SOCIO' | 'LICENCIA' | null;
  perfil: {
    codigo: string;
    direccion: string | null;
    direccionCambiadaEn: string | null;
    enEsperaHasta: string | null;
  } | null;
  cifras?: {
    registrados: number;
    compradores: number;
    registradosSegunda: number;
    compradoresSegunda: number;
    periodo: { inicio: string; fin: string; comisionUsdCents: number };
    acumuladoUsdCents: number;
    porPagarUsdCents: number;
    pagadoUsdCents: number;
  };
  referidos?: {
    nombre: string;
    /** 1: lo invité yo; 2: lo invitó uno de mis referidos (`via`). */
    nivel: 1 | 2;
    via: string | null;
    registradoEn: string | null;
    estado: EstadoReferido;
  }[];
  comisiones?: {
    fecha: string;
    nivel: 1 | 2;
    referido: string;
    via: string | null;
    plan: string;
    montoUsdCents: number;
    porcentajeBp: number;
    comisionUsdCents: number;
    estado: 'ACUMULADA' | 'CERRADA' | 'PAGADA';
  }[];
  pagos?: PagoReferido[];
}

export type EstadoReferido = 'REGISTRADO' | 'CON_LICENCIA' | 'VENCIDA';

export interface PagoReferido {
  id: string;
  inicio: string;
  fin: string;
  ventas: number;
  comisionUsdCents: number;
  direccion: string;
  estado: 'CERRADA' | 'PAGADA';
  enviadoEn: string | null;
  hash: string | null;
}

/** Lo que devuelve `GET /admin/referidos`. */
export interface VistaAdminReferidos {
  ajustes: {
    porcentajeBp: number;
    segundaLineaBp: number;
    minimoPagoUsdCents: number;
    activo: boolean;
  };
  acumuladoUsdCents: number;
  porEnviar: {
    id: string;
    inicio: string;
    fin: string;
    ventas: number;
    comisionUsdCents: number;
    direccion: string;
    cerradoEn: string;
    referidor: { id: string; nombre: string; correo: string };
  }[];
  enviados: {
    id: string;
    inicio: string;
    fin: string;
    comisionUsdCents: number;
    direccion: string;
    enviadoEn: string;
    hash: string | null;
    referidor: string;
    enviadoPor: string | null;
  }[];
  referidores: {
    id: string;
    nombre: string;
    correo: string;
    esAdmin: boolean;
    codigo: string;
    habilitado: boolean;
    habilitadoEn: string | null;
    conDireccion: boolean;
    registrados: number;
    compradores: number;
    registradosSegunda: number;
    compradoresSegunda: number;
    ganadoUsdCents: number;
    acumuladoUsdCents: number;
  }[];
}

/** Lo que devuelve `GET /admin/referidos/clientes/:id`. */
export interface FichaReferidos {
  referidoPor: {
    id: string;
    nombre: string;
    correo: string;
    codigo: string | null;
    desde: string | null;
  } | null;
  puedeReferir: boolean;
  perfil: {
    codigo: string;
    habilitado: boolean;
    habilitadoEn: string | null;
    direccion: string | null;
  } | null;
}
