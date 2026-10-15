import type { ReactNode } from 'react';
import { Etiqueta } from './ui';

/**
 * Pantallas de acceso: el titular grande a la izquierda y el formulario a la derecha (en celular, uno debajo del
 * otro). Mismo lenguaje de la landing de la propuesta 2: negro, sin tarjetas, la jerarquía la da el tamaño.
 */
export function PlantillaAcceso({
  etiqueta,
  titulo,
  texto,
  children,
}: {
  etiqueta: string;
  titulo: ReactNode;
  texto?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid items-start gap-x-24 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div className="grid gap-6 lg:sticky lg:top-16">
        <Etiqueta>{etiqueta}</Etiqueta>
        <h1 className="max-w-[11ch] text-grande">{titulo}</h1>
        {texto ? <div className="max-w-[30em] text-niebla">{texto}</div> : null}
      </div>
      <div className="grid gap-6">{children}</div>
    </div>
  );
}
