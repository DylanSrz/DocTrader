import type { MetadataRoute } from 'next';

/** Manifiesto de la web: nombre e íconos cuando se agrega a la pantalla de inicio del celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DocTraderPRO',
    short_name: 'DocTraderPRO',
    description: 'Licencia de software de copy trading.',
    lang: 'es',
    start_url: '/',
    display: 'browser',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/marca/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/marca/icono-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
