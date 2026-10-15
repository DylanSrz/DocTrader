'use client';

import { useEffect, useState } from 'react';

const EVENTO = 'doctrader:aviso';

/** Muestra un aviso breve abajo de la pantalla ("Dirección copiada", "Datos guardados"). */
export function avisar(texto: string) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: texto }));
}

/** El lugar donde aparecen los avisos breves. Va una vez en el layout del panel. */
export function AvisoBreve() {
  const [texto, setTexto] = useState('');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const mostrar = (evento: Event) => {
      setTexto((evento as CustomEvent<string>).detail);
      setVisible(true);
      clearTimeout(reloj);
      reloj = setTimeout(() => setVisible(false), 2600);
    };
    window.addEventListener(EVENTO, mostrar);
    return () => {
      window.removeEventListener(EVENTO, mostrar);
      clearTimeout(reloj);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      data-visible={visible}
      className="aviso-breve pointer-events-none fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 max-w-[calc(100vw-32px)] rounded-pildora bg-blanco px-5 py-[13px] text-sm font-medium text-vacio"
    >
      {texto}
    </div>
  );
}
