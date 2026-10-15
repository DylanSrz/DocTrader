import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';

/**
 * Casilla de verificación con la etiqueta a la derecha, toda clicable (44 px de alto como mínimo). La marca es un
 * triángulo naranja, el mismo del logo.
 */
export function Casilla({
  children,
  error,
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'type'> & { children: ReactNode; error?: string }) {
  return (
    <div className={cx('grid gap-1', className)}>
      <label className="group flex min-h-11 cursor-pointer items-start gap-3.5 py-1.5 text-[15px] leading-[1.45] font-normal text-niebla">
        <input
          type="checkbox"
          {...input}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="mt-px grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-campo transition-[background-color,box-shadow] duration-200 peer-focus-visible:shadow-[0_0_0_2px_var(--color-senal)] peer-aria-invalid:shadow-[0_0_0_1.5px_var(--color-error)] group-hover:bg-campo-foco [&>svg]:scale-50 [&>svg]:opacity-0 [&>svg]:transition-[opacity,transform] [&>svg]:duration-200 [&>svg]:ease-salida peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100"
        >
          <svg viewBox="0 0 12 12" className="size-3 fill-llama">
            <path d="M6 1.5 11 10.5H1Z" />
          </svg>
        </span>
        <span>{children}</span>
      </label>
      {error ? <p className="pl-[36px] text-sm text-error">{error}</p> : null}
    </div>
  );
}
