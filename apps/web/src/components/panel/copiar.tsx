'use client';

import { useState } from 'react';
import { avisar } from './aviso-breve';

/**
 * Copia un texto (la dirección, el monto). Si el navegador no deja copiar, selecciona el texto para que la persona
 * lo copie con el teclado.
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
  const [copiado, setCopiado] = useState(false);
  const seleccionar = () => {
    const nodo = document.getElementById(idTexto);
    if (!nodo) return;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    const seleccion = window.getSelection();
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
    avisar(`${que} seleccionado: cópialo con tu teclado`);
  };
  return (
    <button
      type="button"
      onClick={() => {
        if (!navigator.clipboard?.writeText) return seleccionar();
        navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true);
          avisar(`${que} copiado`);
          setTimeout(() => setCopiado(false), 1800);
        }, seleccionar);
      }}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pildora bg-campo px-[18px] texto-menu text-blanco transition-[transform,background-color] duration-200 ease-salida select-none hover:bg-campo-foco active:scale-[0.97] motion-reduce:transition-none"
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
