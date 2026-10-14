import type { ReactNode } from 'react';
import { cx } from './cx';
import { Triangulo } from './triangulo';

const TONOS = {
  /** Bien: conectada, aprobado. */
  senal: { clases: 'text-senal bg-senal/12', relleno: true },
  /** Requiere atención: vence pronto. */
  llama: { clases: 'text-llama bg-llama/14', relleno: true },
  /** En espera: por conectar, pendiente. */
  neutro: { clases: 'text-blanco bg-white/8', relleno: false },
  /** Terminado: expirada, desconectada. */
  apagado: { clases: 'text-ceniza bg-white/8', relleno: false },
  /** Falló: rechazado, monto incompleto. */
  error: { clases: 'text-error bg-error/12', relleno: true },
} as const;

/** Estado en píldora: siempre forma (triángulo) y palabra, nunca solo color. */
export function Estado({ tono, children }: { tono: keyof typeof TONOS; children: ReactNode }) {
  const { clases, relleno } = TONOS[tono];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pr-3 pl-2.5 text-[13px] leading-[1.2] font-medium',
        clases,
      )}
    >
      <Triangulo relleno={relleno} invertido={tono === 'error'} />
      {children}
    </span>
  );
}
