import { CORREO_SOPORTE } from '@doctrader/shared';
import { cx } from './ui';

/**
 * El correo de soporte como enlace `mailto:`: al tocarlo se abre la app de correo para escribir. Hereda el tamaño y
 * el color del texto donde va; solo agrega el subrayado de los enlaces.
 */
export function CorreoSoporte({
  correo = CORREO_SOPORTE,
  className,
}: {
  correo?: string;
  className?: string;
}) {
  return (
    <a
      href={`mailto:${correo}`}
      translate="no"
      className={cx(
        'underline decoration-white/35 underline-offset-4 transition-colors duration-200 hover:text-blanco hover:decoration-current [overflow-wrap:anywhere]',
        className,
      )}
    >
      {correo}
    </a>
  );
}
