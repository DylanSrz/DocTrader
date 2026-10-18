'use client';

import { CorreoSoporte } from '@/components/correo-soporte';
import { PantallaAviso } from '@/components/pantalla-aviso';
import { Enlace, Pildora } from '@/components/ui';

/** Error inesperado al pintar una página. El servidor ya lo reportó a Sentry; aquí solo se ofrece reintentar. */
export default function ErrorDePagina({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PantallaAviso
      etiqueta="Algo falló"
      titulo="No pudimos cargar esta página."
      texto={
        <>
          Fue un error nuestro, no tuyo. Intenta de nuevo en un momento; si sigue pasando,
          escríbenos a <CorreoSoporte />.
        </>
      }
    >
      <Pildora onClick={() => reset()}>Intentar de nuevo</Pildora>
      <Enlace href="/" gris>
        Ir al inicio
      </Enlace>
    </PantallaAviso>
  );
}
