import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from './cx';

/** Enlace subrayado: la acción secundaria. `gris` para notas y pies. Área táctil de 44 px. */
export function Enlace({
  gris = false,
  nativo = false,
  className,
  ...props
}: ComponentProps<typeof Link> & {
  gris?: boolean;
  /** Un enlace normal, que el servidor resuelve (por ejemplo, una ruta que redirige según la sesión). */
  nativo?: boolean;
}) {
  const clases = cx(
    'inline-flex min-h-11 items-center text-sm font-normal underline decoration-white/35 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-current',
    gris ? 'text-ceniza hover:text-blanco' : 'text-blanco',
    className,
  );
  if (nativo && typeof props.href === 'string') {
    return (
      <a href={props.href} className={clases}>
        {props.children}
      </a>
    );
  }
  return <Link {...props} className={clases} />;
}
