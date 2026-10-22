import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  // Pesos del sistema: 300 para el texto, 400 para titulares, 500 y 600 para menús y botones.
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITIO_URL ?? 'https://www.doctraderpro.com'),
  title: {
    default: 'DocTraderPRO — Licencia de software de copy trading',
    template: '%s · DocTraderPRO',
  },
  description:
    'Licencia de uso del software Doc Trader Pro AI: conecta tu cuenta de trading y el sistema replica cada operación en tu broker.',
  applicationName: 'DocTraderPRO',
  // Vista previa al compartir el enlace (WhatsApp, Telegram, Facebook, LinkedIn, X…). La imagen sale de
  // `app/opengraph-image.png` y `app/twitter-image.png`; cada página puede cambiar el título y la descripción.
  openGraph: {
    type: 'website',
    siteName: 'DocTraderPRO',
    locale: 'es_CO',
    url: '/',
    title: 'DocTraderPRO · Licencia de software de copy trading',
    description:
      'Conecta tu cuenta de trading al sistema DocTrader Pro: cada operación se replica en tu broker. Tu dinero nunca sale de tu cuenta.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocTraderPRO · Licencia de software de copy trading',
    description:
      'Conecta tu cuenta de trading al sistema DocTrader Pro: cada operación se replica en tu broker. Tu dinero nunca sale de tu cuenta.',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
