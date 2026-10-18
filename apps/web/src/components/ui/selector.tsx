'use client';

import { type ComponentProps, useId } from 'react';
import { cx } from './cx';

/** Lista desplegable con la misma forma de los campos: etiqueta visible y error conectado. */
export function Selector({
  etiqueta,
  error,
  className,
  id,
  children,
  ...select
}: ComponentProps<'select'> & { etiqueta: string; error?: string }) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idError = error ? `${idCampo}-error` : undefined;
  return (
    <div className={cx('grid w-full gap-2', className)}>
      <label htmlFor={idCampo} className="text-[15px] font-normal text-blanco">
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={idCampo}
          aria-invalid={error ? true : undefined}
          aria-describedby={idError}
          {...select}
          className="min-h-[52px] w-full cursor-pointer appearance-none rounded-pildora bg-campo py-3.5 pr-12 pl-5 text-base font-normal text-blanco transition-[background-color,box-shadow] duration-200 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none aria-invalid:shadow-[0_0_0_1.5px_var(--color-error)]"
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute top-1/2 right-5 size-3 -translate-y-1/2 text-ceniza"
        >
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {error ? (
        <p id={idError} className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
