import type { Metadata } from 'next';
import { PantallaAviso } from '@/components/pantalla-aviso';
import { Enlace, Pildora } from '@/components/ui';

export const metadata: Metadata = { title: 'Página no encontrada' };

export default function NoEncontrada() {
  return (
    <PantallaAviso
      etiqueta="Error 404"
      titulo="Esta página no existe."
      texto="Puede que el enlace esté incompleto o que la página ya no esté. Desde el inicio llegas a todo lo demás."
    >
      <Pildora href="/">Ir al inicio</Pildora>
      <Enlace href="/panel" gris>
        Ir a mi panel
      </Enlace>
    </PantallaAviso>
  );
}
