'use client';

import { BotonAccion, copiarTexto, useEstadoAccion } from '@/components/ui';
import { avisar } from './aviso-breve';

/**
 * Copia un texto (la dirección, el monto). El botón cambia a "¡Copiado!" solo cuando el texto quedó en el
 * portapapeles. Si el navegador no deja copiar, lo dice y selecciona el texto para copiarlo con el teclado.
 */
export function Copiar({
  texto,
  idTexto,
  que,
}: {
  texto: string;
  /** El elemento que muestra el texto, para seleccionarlo si no se puede copiar. */
  idTexto: string;
  /** "Dirección", "Monto": para el aviso. */
  que: string;
}) {
  const [estado, setEstado] = useEstadoAccion();
  const seleccionar = () => {
    const nodo = document.getElementById(idTexto);
    if (!nodo) return;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    const seleccion = window.getSelection();
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
  };
  return (
    <BotonAccion
      estado={estado}
      textos={{
        normal: 'Copiar',
        procesando: 'Copiando…',
        exito: '¡Copiado!',
        error: 'No se copió',
      }}
      onClick={async () => {
        setEstado('procesando');
        if (await copiarTexto(texto)) {
          setEstado('exito');
          avisar(`${que} copiado`);
        } else {
          setEstado('error');
          seleccionar();
          avisar(
            `No pudimos copiar: ${que.toLowerCase()} quedó seleccionado, cópialo con tu teclado`,
          );
        }
      }}
    />
  );
}
