import * as Sentry from '@sentry/node';

/** Encabezados que nunca salen hacia Sentry: sesiones, secretos de la web y fichas de subida. */
const ENCABEZADOS_PRIVADOS = /^(authorization|cookie|x-doctrader-.*|x-proxy-.*)$/i;

/**
 * Quita lo personal y lo secreto de un evento antes de enviarlo (`docs/SEGURIDAD.md` §14): cuerpos, cookies,
 * encabezados sensibles, parámetros de la URL y datos del usuario. Queda el error, la pila y la ruta.
 */
export function limpiarEvento<E extends Sentry.ErrorEvent>(evento: E): E {
  if (evento.request) {
    delete evento.request.data;
    delete evento.request.cookies;
    delete evento.request.query_string;
    if (evento.request.headers) {
      evento.request.headers = Object.fromEntries(
        Object.entries(evento.request.headers).filter(
          ([nombre]) => !ENCABEZADOS_PRIVADOS.test(nombre),
        ),
      );
    }
  }
  delete evento.user;
  return evento;
}

/**
 * Activa Sentry si hay `SENTRY_DSN`; sin ella no hace nada (desarrollo y pruebas). Solo errores, sin trazas de
 * rendimiento ni datos personales (`sendDefaultPii: false`).
 */
export function iniciarSentry(servicio: 'api' | 'worker'): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    serverName: servicio,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (evento) => limpiarEvento(evento),
  });
  Sentry.setTag('servicio', servicio);
}

/** Envía un error inesperado (si Sentry está activo) con un poco de contexto que no es personal. */
export function reportarError(error: unknown, contexto: Record<string, string> = {}): void {
  Sentry.withScope((alcance) => {
    for (const [clave, valor] of Object.entries(contexto)) alcance.setTag(clave, valor);
    Sentry.captureException(error);
  });
}
