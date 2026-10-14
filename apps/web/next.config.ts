import type { NextConfig } from 'next';

const desarrollo = process.env.NODE_ENV === 'development';

/**
 * Política de contenido (`docs/SEGURIDAD.md` §11). Solo se carga lo propio, Turnstile de Cloudflare y las
 * imágenes del widget de Myfxbook. Va sin nonces: con nonces todas las páginas serían dinámicas y se perdería el
 * prerenderizado; React ya escapa todo lo que muestra y la web no inserta HTML de usuarios. Cuando la
 * integridad de subrecursos (SRI) de Next deje de ser experimental, se cambia `'unsafe-inline'` por ella.
 */
const politicaDeContenido = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${desarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://widgets.myfxbook.com https://widget.mfbcdn.net",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(desarrollo ? [] : ['upgrade-insecure-requests']),
].join('; ');

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
      // Las páginas con sesión o con enlaces de un solo uso no se guardan en cachés compartidas.
      {
        source: '/(panel|admin|segundo-factor|restablecer|verificar-correo)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

export default nextConfig;
