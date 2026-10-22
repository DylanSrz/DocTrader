import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CORREO_SOPORTE,
  DOCUMENTOS_LEGALES,
  dolaresPorMes,
  ENLACES_INICIALES,
  MYFXBOOK_INICIAL,
  PLANES_INICIALES,
  type PreguntaFrecuente,
  PREGUNTAS_INICIALES,
  REFERIDOS_INICIAL,
  textoPublicoDeBorrador,
  type TipoDocumentoLegal,
} from '@doctrader/shared';
import { cacheLife, cacheTag } from 'next/cache';

/** Etiquetas de caché: el panel de admin las invalida al guardar, y la página pública se vuelve a armar. */
export const ETIQUETA_LANDING = 'landing';
export const ETIQUETA_LEGAL = 'legal';

export interface PlanPublico {
  codigo: string;
  nombre: string;
  meses: number | null;
  mesesObsequio: number;
  dias: number | null;
  precioUsdCentavos: number;
  dolaresPorMes: number | null;
  publico: boolean;
}

export interface Landing {
  planes: PlanPublico[];
  preguntas: PreguntaFrecuente[];
  myfxbook: typeof MYFXBOOK_INICIAL;
  enlaces: typeof ENLACES_INICIALES;
  correoSoporte: string;
  referidos: { activo: boolean; porcentajeBp: number };
}

export interface TextoLegal {
  tipo: TipoDocumentoLegal;
  version: number;
  publicadoEn: string | null;
  contenido: string;
}

/**
 * Lectura de datos públicos de la API, sin sesión ni datos del visitante (se puede guardar en caché). Devuelve
 * `null` si la API no está configurada o no responde: por ejemplo, al compilar en la integración continua.
 */
async function leerPublico<T>(ruta: string): Promise<T | null> {
  const url = process.env.API_URL;
  const secreto = process.env.PROXY_SECRET;
  if (!url || !secreto) return null;
  try {
    const respuesta = await fetch(new URL(ruta, url), {
      headers: { 'x-doctrader-proxy': secreto },
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as T;
  } catch {
    return null;
  }
}

/** Lo mismo que trae la semilla: lo que se muestra si la API no responde. */
const LANDING_DE_RESPALDO: Landing = {
  planes: PLANES_INICIALES.map((p) => ({
    codigo: p.code,
    nombre: p.name,
    meses: p.durationMonths,
    mesesObsequio: p.bonusMonths,
    dias: p.durationDays,
    precioUsdCentavos: p.priceUsdCents,
    dolaresPorMes: dolaresPorMes(p),
    publico: p.isPublic,
  })),
  preguntas: [...PREGUNTAS_INICIALES],
  myfxbook: MYFXBOOK_INICIAL,
  enlaces: ENLACES_INICIALES,
  correoSoporte: CORREO_SOPORTE,
  referidos: { activo: REFERIDOS_INICIAL.activo, porcentajeBp: REFERIDOS_INICIAL.porcentajeBp },
};

/**
 * Cuánto dura en caché lo que llega de la API. Lo que cambia el admin se ve al instante (`updateTag`); lo que
 * cambia sin pasar por el panel (una migración al desplegar) se ve en 5 minutos como máximo.
 */
const CINCO_MINUTOS = { stale: 300, revalidate: 300, expire: 86_400 };

/**
 * Datos de la landing. Si la API no responde, se usan los de respaldo por pocos minutos y se vuelve a intentar.
 */
export async function obtenerLanding(): Promise<Landing> {
  'use cache';
  cacheTag(ETIQUETA_LANDING);
  const datos = await leerPublico<Partial<Landing>>('/publico/landing');
  if (!datos?.planes) {
    cacheLife('minutes');
    return LANDING_DE_RESPALDO;
  }
  cacheLife(CINCO_MINUTOS);
  return {
    planes: datos.planes,
    preguntas: datos.preguntas ?? LANDING_DE_RESPALDO.preguntas,
    myfxbook: datos.myfxbook ?? LANDING_DE_RESPALDO.myfxbook,
    enlaces: datos.enlaces ?? LANDING_DE_RESPALDO.enlaces,
    correoSoporte: datos.correoSoporte ?? CORREO_SOPORTE,
    referidos: datos.referidos ?? LANDING_DE_RESPALDO.referidos,
  };
}

const ARCHIVOS_LEGALES: Record<TipoDocumentoLegal, string> = {
  TERMS: 'terminos-licencia.md',
  PRIVACY: 'politica-datos.md',
  RISK: 'aviso-riesgo.md',
};

/** Texto legal vigente. Si la API no responde, el borrador de `docs/legal/` (el mismo que carga la semilla). */
export async function obtenerTextoLegal(tipo: TipoDocumentoLegal): Promise<TextoLegal> {
  'use cache';
  cacheTag(ETIQUETA_LEGAL);
  const desdeApi = await leerPublico<TextoLegal>(`/publico/legal/${DOCUMENTOS_LEGALES[tipo].ruta}`);
  if (desdeApi) {
    cacheLife(CINCO_MINUTOS);
    return desdeApi;
  }
  cacheLife('minutes');
  const archivo = path.join(process.cwd(), '..', '..', 'docs', 'legal', ARCHIVOS_LEGALES[tipo]);
  const markdown = await readFile(archivo, 'utf8');
  return {
    tipo,
    version: 1,
    publicadoEn: null,
    contenido: textoPublicoDeBorrador(markdown),
  };
}
