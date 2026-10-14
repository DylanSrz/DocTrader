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
  metadataBase: new URL('https://doctraderpro.com'),
  title: {
    default: 'DocTraderPRO — Licencia de software de copy trading',
    template: '%s · DocTraderPRO',
  },
  description:
    'Licencia de uso del software Doc Trader Pro AI: conecta tu cuenta de trading y el sistema replica cada operación en tu broker.',
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
