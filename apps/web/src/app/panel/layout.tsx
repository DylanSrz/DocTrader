import type { ReactNode } from 'react';
import { Cabecera } from '@/components/panel/cabecera';
import { PieLegal } from '@/components/pie-legal';

export default function LayoutPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera pestanas={[{ href: '/panel', texto: 'Mis cuentas' }]} actual="/panel" />
      <main id="contenido" className="contenedor flex-1 py-16 lg:py-24">
        {children}
      </main>
      <PieLegal />
    </div>
  );
}
