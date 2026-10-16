import type { ReactNode } from 'react';
import { Marca } from './marca';
import { PieLegal } from './pie-legal';
import { Etiqueta } from './ui';

/** Página de un solo mensaje (404, error): logo, etiqueta, titular, texto y acciones. Mismo lenguaje del acceso. */
export function PantallaAviso({
  etiqueta,
  titulo,
  texto,
  children,
}: {
  etiqueta: string;
  titulo: string;
  texto: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="contenedor pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <Marca />
      </header>
      <main
        id="contenido"
        className="contenedor flex flex-1 flex-col justify-center py-16 lg:py-24"
      >
        <div className="grid justify-items-start gap-6">
          <Etiqueta>{etiqueta}</Etiqueta>
          <h1 className="max-w-[14ch] text-grande">{titulo}</h1>
          <p className="max-w-[30em] text-niebla">{texto}</p>
          <div className="mt-4 flex flex-wrap items-center gap-6">{children}</div>
        </div>
      </main>
      <PieLegal />
    </div>
  );
}
