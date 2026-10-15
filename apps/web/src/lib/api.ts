import 'server-only';
import { headers } from 'next/headers';

/** Respuesta de error de la API: un código estable y un mensaje en español que se puede mostrar. */
export interface ErrorApi {
  codigo: string;
  mensaje: string;
  campos?: Record<string, string>;
  reintentarEn?: number;
  desafio?: boolean;
}

export type RespuestaApi<T> =
  { ok: true; estado: number; datos: T } | { ok: false; estado: number; error: ErrorApi };

const SIN_CONEXION: ErrorApi = {
  codigo: 'SIN_CONEXION',
  mensaje: 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.',
};

/**
 * Llama a la API desde el servidor de la web (nunca desde el navegador). Firma la petición con el secreto
 * compartido y reenvía la IP y el navegador del cliente, que la API usa para los límites y los avisos. La sesión
 * viaja en `Authorization`: el token vive en una cookie de este dominio que el navegador no puede leer.
 */
export async function llamarApi<T>(
  ruta: string,
  opciones: { metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'; cuerpo?: unknown; token?: string } = {},
): Promise<RespuestaApi<T>> {
  const url = process.env.API_URL;
  const secreto = process.env.PROXY_SECRET;
  if (!url || !secreto) throw new Error('Faltan API_URL o PROXY_SECRET en las variables de la web');

  const entrantes = await headers();
  // En Vercel, x-real-ip y x-forwarded-for los pone su borde: el cliente no los puede falsificar.
  const ip =
    entrantes.get('x-real-ip') ?? entrantes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';

  try {
    const respuesta = await fetch(new URL(ruta, url), {
      method: opciones.metodo ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-doctrader-proxy': secreto,
        'x-doctrader-ip': ip,
        'x-doctrader-agente': entrantes.get('user-agent') ?? '',
        ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: 'no-store',
      // Una redirección significa que API_URL está mal (por ejemplo, con http:// en vez de https://): al
      // seguirla, el POST se volvería GET. Mejor fallar y decirlo en el registro.
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    if (respuesta.status >= 300 && respuesta.status < 400) {
      console.error(
        `La API redirige ${ruta} a ${respuesta.headers.get('location')}: revisa API_URL (debe empezar con https://)`,
      );
      return { ok: false, estado: 502, error: SIN_CONEXION };
    }
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    if (respuesta.ok) return { ok: true, estado: respuesta.status, datos: cuerpo as T };
    const error = cuerpo as Partial<ErrorApi> | null;
    if (error?.codigo && error.mensaje) {
      if (respuesta.status >= 500)
        console.error(`La API respondió ${respuesta.status} en ${ruta}: ${error.codigo}`);
      return { ok: false, estado: respuesta.status, error: error as ErrorApi };
    }
    console.error(`Respuesta inesperada de la API en ${ruta}: ${respuesta.status}`);
    return {
      ok: false,
      estado: respuesta.status,
      error: { codigo: 'ERROR', mensaje: 'Algo salió mal. Intenta de nuevo en un momento.' },
    };
  } catch (falla) {
    console.error(`No se pudo llamar a la API en ${ruta}: ${(falla as Error).message}`);
    return { ok: false, estado: 503, error: SIN_CONEXION };
  }
}
