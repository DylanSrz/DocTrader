import { cx } from './cx';

/**
 * La unidad del sistema: un triángulo. Relleno para lo que pasó o está activo, vacío para lo pendiente.
 * Es decorativo: el significado siempre va también en texto.
 */
export function Triangulo({
  relleno = true,
  tamano = 8,
  invertido = false,
  className,
}: {
  relleno?: boolean;
  tamano?: number;
  invertido?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 7"
      width={tamano}
      height={(tamano * 7) / 8}
      className={cx('shrink-0', invertido && 'rotate-180', className)}
    >
      <path
        d="M4 .9 7.3 6.5H.7Z"
        fill={relleno ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={relleno ? 0 : 1}
      />
    </svg>
  );
}
