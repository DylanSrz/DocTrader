import { DOCUMENTOS_LEGALES } from '@doctrader/shared';
import type { MetadataRoute } from 'next';

const SITIO = process.env.SITIO_URL ?? 'https://doctraderpro.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITIO, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITIO}/registro`, changeFrequency: 'yearly', priority: 0.6 },
    ...Object.values(DOCUMENTOS_LEGALES).map((d) => ({
      url: `${SITIO}/legal/${d.ruta}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ];
}
