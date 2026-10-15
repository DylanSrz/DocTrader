import type { MetadataRoute } from 'next';

const SITIO = process.env.SITIO_URL ?? 'https://doctraderpro.com';

/** Los paneles y las páginas de acceso no se indexan; la landing y los textos legales sí. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/legal/'],
      disallow: [
        '/panel',
        '/admin',
        '/segundo-factor',
        '/restablecer',
        '/verificar-correo',
        '/sistema',
      ],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
