'use client';

import { type ComponentProps, type ReactNode, useId } from 'react';
import { cx } from './cx';

/**
 * Campo de formulario: etiqueta visible, ayuda opcional y error conectado por `aria-describedby`.
 * El texto va en 16 px para que el iPhone no haga zoom al escribir.
 */
export function Campo({
  etiqueta,
  ayuda,
  error,
  className,
  id,
  final,
  ...input
}: ComponentProps<'input'> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  /** Algo dentro del campo, a la derecha (por ejemplo, "Mostrar" en una contraseña). */
  final?: ReactNode;
}) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
  const idError = error ? `${idCampo}-error` : undefined;
  return (
    <div className={cx('grid w-full gap-2', className)}>
      <label htmlFor={idCampo} className="text-[15px] font-normal text-blanco">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={idCampo}
          aria-invalid={error ? true : undefined}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
          {...input}
          className={cx(
            'min-h-[52px] w-full rounded-pildora bg-campo px-5 py-3.5 text-base font-normal text-blanco transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none read-only:text-ceniza read-only:focus-visible:bg-campo read-only:focus-visible:shadow-none aria-invalid:shadow-[0_0_0_1.5px_var(--color-error)]',
            final ? 'pr-28' : undefined,
          )}
        />
        {final ? <div className="absolute inset-y-0 right-2 flex items-center">{final}</div> : null}
      </div>
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
