import type { ComponentProps } from 'react';
import { cx } from './cx';

/** Etiqueta en verde limón sobre los titulares: "Licencia de software de copy trading". */
export function Etiqueta({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={cx('texto-menu text-senal', className)} />;
}
