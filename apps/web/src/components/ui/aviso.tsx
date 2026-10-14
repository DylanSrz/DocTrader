import type { ReactNode } from 'react';
import { cx } from './cx';
import { Triangulo } from './triangulo';

/**
 * Mensaje después de enviar un formulario. Los errores se anuncian de inmediato al lector de pantalla; los
 * éxitos, con cortesía.
 */
export function Aviso({
  tono = 'error',
  children,
  className,
}: {
  tono?: 'error' | 'exito' | 'neutro';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-pildora px-5 py-3.5 text-[15px] leading-[1.45] font-normal',
        tono === 'error' && 'bg-error/12 text-error',
        tono === 'exito' && 'bg-senal/12 text-senal',
        tono === 'neutro' && 'bg-campo text-niebla',
        className,
      )}
    >
      <span className="mt-[5px] shrink-0">
        <Triangulo relleno={tono !== 'neutro'} invertido={tono === 'error'} />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
