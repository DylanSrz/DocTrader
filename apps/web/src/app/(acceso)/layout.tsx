import type { ReactNode } from 'react';
import { Marca } from '@/components/marca';
import { PieLegal } from '@/components/pie-legal';

export default function LayoutAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="contenedor pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <Marca />
      </header>
      <main
        id="contenido"
        className="contenedor flex flex-1 flex-col justify-center py-16 lg:py-24"
      >
        {children}
      </main>
      <PieLegal />
    </div>
  );
}
