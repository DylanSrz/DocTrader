import type { ReactNode } from 'react';
import { Cabecera } from '@/components/panel/cabecera';
import { PieLegal } from '@/components/pie-legal';

export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera
        pestanas={[
          { href: '/admin', texto: 'Hoy' },
          { href: '/admin/preguntas', texto: 'Preguntas' },
          { href: '/admin/legal', texto: 'Textos legales' },
        ]}
      />
      <main id="contenido" className="contenedor flex-1 py-16 lg:py-24">
        {children}
      </main>
      <PieLegal />
    </div>
  );
}
