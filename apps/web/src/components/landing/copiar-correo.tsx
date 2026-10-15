'use client';

import { useState } from 'react';

/** El correo oficial como texto seleccionable, con botón de copiar: los enlaces mailto no siempre abren algo. */
export function CopiarCorreo({ correo }: { correo: string }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'manual'>('listo');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(correo);
      setEstado('copiado');
    } catch {
      setEstado('manual');
    }
    setTimeout(() => setEstado('listo'), 1800);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="text-blanco select-all" translate="no">
        {correo}
      </span>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] transition-colors hover:text-blanco hover:decoration-current"
        aria-live="polite"
      >
        {estado === 'copiado'
          ? 'Copiado'
          : estado === 'manual'
            ? 'Selecciónalo y cópialo'
            : 'Copiar correo'}
      </button>
    </span>
  );
}
