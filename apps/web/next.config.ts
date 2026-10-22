import type { NextConfig } from 'next';

const desarrollo = process.env.NODE_ENV === 'development';

/** La API, para la subida de adjuntos: el navegador los manda directo (no caben por las funciones de Vercel). */
const api = (() => {
  try {
    return process.env.API_URL ? new URL(process.env.API_URL).origin : '';
  } catch {
    return '';
  }
})();

/**
 * Política de contenido (`docs/SEGURIDAD.md` §11). Solo se carga lo propio, Turnstile de Cloudflare y las
 * imágenes del widget de Myfxbook (y, solo en `/presentacion`, el iframe del gráfico de TradingView); el navegador solo se conecta con la web, Turnstile y la API (adjuntos). Va sin nonces: con nonces todas las páginas serían dinámicas y se perdería el
 * prerenderizado; React ya escapa todo lo que muestra y la web no inserta HTML de usuarios. Cuando la
 * integridad de subrecursos (SRI) de Next deje de ser experimental, se cambia `'unsafe-inline'` por ella.
 */
const politica = ({ marcos }: { marcos: string }) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${desarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://widgets.myfxbook.com https://widget.mfbcdn.net",
    "font-src 'self'",
    `connect-src 'self' https://challenges.cloudflare.com${api ? ` ${api}` : ''}`,
    `frame-src https://challenges.cloudflare.com${marcos}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(desarrollo ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
const politicaDeContenido = politica({ marcos: '' });
/** La presentación muestra un gráfico en vivo de TradingView (su widget oficial, en un iframe). */
const politicaDePresentacion = politica({
  marcos: ' https://s.tradingview.com https://www.tradingview-widget.com',
});

const encabezadosDeSeguridad = [
  { key: 'Content-Security-Policy', value: politicaDeContenido },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: encabezadosDeSeguridad },
      // Va después: para esta página reemplaza la política general.
      {
        source: '/presentacion',
        headers: [{ key: 'Content-Security-Policy', value: politicaDePresentacion }],
      },
      // Las páginas con sesión o con enlaces de un solo uso no se guardan en cachés compartidas.
      {
        source: '/(panel|admin|segundo-factor|restablecer|verificar-correo)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

export default nextConfig;
