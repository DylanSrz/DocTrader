import type { Instrumentation } from 'next';

/** Encabezados que nunca salen hacia Sentry: la cookie de sesión y los secretos entre la web y la API. */
const PRIVADOS = /^(authorization|cookie|set-cookie|x-doctrader-.*|x-proxy-.*)$/i;

/**
 * Errores del servidor de Next en Sentry, solo si hay `SENTRY_DSN` (`docs/SEGURIDAD.md` §14). Sin script en el
 * navegador (la CSP no lo permitiría y no hace falta), sin trazas de rendimiento y sin datos personales: se quitan
 * cuerpos, cookies, parámetros y encabezados sensibles antes de enviar.
 */
export async function register() {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(evento) {
      if (evento.request) {
        delete evento.request.data;
        delete evento.request.cookies;
        delete evento.request.query_string;
        if (evento.request.headers) {
          evento.request.headers = Object.fromEntries(
            Object.entries(evento.request.headers).filter(([nombre]) => !PRIVADOS.test(nombre)),
          );
        }
      }
      delete evento.user;
      return evento;
    },
  });
  Sentry.setTag('servicio', 'web');
}

export const onRequestError: Instrumentation.onRequestError = async (...argumentos) => {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...argumentos);
};
