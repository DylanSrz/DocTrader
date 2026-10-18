'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from './cx';

/**
 * Estados de copiar y descargar. `exito` y `error` vuelven solos al normal después de unos segundos; el éxito solo
 * se muestra cuando la operación de verdad terminó bien.
 */
export type EstadoAccion = 'normal' | 'procesando' | 'exito' | 'error';

const DURACION_MS = { exito: 2200, error: 4000 } as const;

export function useEstadoAccion() {
  const [estado, setEstado] = useState<EstadoAccion>('normal');
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const cambiar = (nuevo: EstadoAccion) => {
    clearTimeout(reloj.current);
    setEstado(nuevo);
    if (nuevo === 'exito' || nuevo === 'error') {
      reloj.current = setTimeout(() => setEstado('normal'), DURACION_MS[nuevo]);
    }
  };
  return [estado, cambiar] as const;
}

/**
 * Copia un texto. `writeText` solo se cumple cuando el texto ya está en el portapapeles; si falla (sin permiso, sin
 * HTTPS, navegador viejo) devuelve `false`. No se vuelve a leer para comparar: leer el portapapeles le pide permiso
 * a la persona.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Descarga un contenido ya generado en el navegador (CSV, códigos) como archivo. */
export function descargarContenido(contenido: string, nombre: string, tipo: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

function Icono({ estado }: { estado: EstadoAccion }) {
  if (estado === 'exito') {
    return (
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0 text-senal">
        <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (estado === 'error') {
    return (
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0 text-error">
        <path d="M6 2v5M6 9.2v.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (estado === 'procesando') {
    return (
      <span
        aria-hidden="true"
        className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent motion-reduce:animate-none"
      />
    );
  }
  return null;
}

/**
 * Botón de copiar o descargar con sus cuatro estados: normal, procesando, éxito y error. El texto de cada estado lo
 * pone quien lo usa ("Copiar" → "¡Copiado!"; "Descargar" → "Descargando…" → "Descargado"). Los cambios se anuncian
 * a los lectores de pantalla.
 */
export function BotonAccion({
  estado,
  textos,
  onClick,
  variante = 'pildora',
  className,
}: {
  estado: EstadoAccion;
  textos: Record<EstadoAccion, ReactNode>;
  onClick: () => void;
  variante?: 'pildora' | 'enlace';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={estado === 'procesando'}
      aria-live="polite"
      className={cx(
        variante === 'pildora'
          ? 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-pildora bg-campo px-[18px] texto-menu text-blanco transition-[transform,background-color] duration-200 ease-salida select-none hover:bg-campo-foco active:scale-[0.97] motion-reduce:transition-none'
          : 'inline-flex min-h-11 items-center gap-2 text-sm font-normal text-blanco underline decoration-white/35 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-current',
        estado === 'error' && 'text-error',
        estado === 'procesando' && 'cursor-progress opacity-80',
        className,
      )}
    >
      <Icono estado={estado} />
      {textos[estado]}
    </button>
  );
}
