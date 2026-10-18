import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from './cx';

const clases =
  'inline-flex min-h-[46px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pildora bg-llama px-[22px] py-3.5 texto-menu text-vacio no-underline select-none transition-[transform,background-color] duration-200 ease-salida active:scale-[0.97] hover:bg-llama-viva disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none';

/**
 * El único botón relleno del sistema, en naranja. Una sola píldora por vista: lo demás son enlaces.
 * Con `href` es un enlace; sin `href`, un botón.
 */
export function Pildora(
  props:
    | (ComponentProps<'button'> & { href?: undefined })
    | (ComponentProps<typeof Link> & { href: string; nativo?: boolean }),
) {
  if (props.href !== undefined) {
    const { className, nativo, ...resto } = props;
    // `nativo`: un enlace normal, que el servidor resuelve (por ejemplo, una ruta que redirige según la sesión).
    if (nativo)
      return (
        <a href={resto.href} className={cx(clases, className)}>
          {resto.children}
        </a>
      );
    return <Link {...resto} className={cx(clases, className)} />;
  }
  const { className, type = 'button', ...resto } = props;
  return <button type={type} {...resto} className={cx(clases, className)} />;
}
