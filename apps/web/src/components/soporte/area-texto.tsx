'use client';

import { type ComponentProps, useId } from 'react';
import { cx } from '@/components/ui';

/** Área de texto con la forma de los campos: etiqueta visible, ayuda y error conectados. 16 px contra el zoom. */
export function AreaTexto({
  etiqueta,
  ayuda,
  error,
  className,
  id,
  ...area
}: ComponentProps<'textarea'> & { etiqueta: string; ayuda?: string; error?: string }) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
  const idError = error ? `${idCampo}-error` : undefined;
  return (
    <div className={cx('grid w-full gap-2', className)}>
      <label htmlFor={idCampo} className="text-[15px] text-blanco">
        {etiqueta}
      </label>
      <textarea
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
        {...area}
        className="min-h-[120px] w-full resize-y rounded-[20px] bg-campo px-5 py-3.5 text-base text-blanco transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none aria-invalid:shadow-[0_0_0_1.5px_var(--color-error)]"
      />
      {ayuda ? (
        <p id={idAyuda} className="text-sm text-ceniza">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={idError} className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
