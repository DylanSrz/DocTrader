'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { cx } from './cx';
import { Pildora } from './pildora';

/**
 * La píldora de un formulario. Mientras se envía queda desactivada y dice qué está pasando, para que nadie
 * presione dos veces.
 */
export function BotonEnviar({
  children,
  enviando,
  variante = 'pildora',
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'type'> & {
  children: ReactNode;
  enviando: string;
  /** `enlace` para la acción secundaria: solo hay una píldora por vista. */
  variante?: 'pildora' | 'enlace';
}) {
  const { pending } = useFormStatus();
  if (variante === 'enlace') {
    return (
      <button
        {...props}
        type="submit"
        disabled={pending || props.disabled}
        className={cx(
          'inline-flex min-h-11 items-center text-sm font-normal text-blanco underline decoration-white/35 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-current disabled:opacity-50',
          className,
        )}
      >
        {pending ? enviando : children}
      </button>
    );
  }
  return (
    <Pildora
      {...props}
      className={className}
      type="submit"
      disabled={pending || props.disabled}
      aria-disabled={pending}
    >
      {pending ? enviando : children}
    </Pildora>
  );
}
