'use client';

import { type ReactNode, useCallback, useId, useRef } from 'react';
import { cx } from './ui';

/**
 * Menú de celular y tablet: un botón de tres líneas que abre un panel lateral (`<dialog>` modal, así el foco queda
 * adentro y Escape lo cierra). Se cierra al tocar fuera, con la X o al elegir cualquier enlace o botón del menú.
 * En escritorio no se muestra: `className` dice desde qué ancho se oculta (por ejemplo `lg:hidden`).
 */
export function MenuMovil({
  etiqueta,
  cabecera,
  className,
  children,
}: {
  /** "Menú principal", "Menú del panel": nombre del botón y del panel para lectores de pantalla. */
  etiqueta: string;
  /** Lo que va arriba del panel, a la izquierda de la X (el logo). */
  cabecera?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const cerrar = useCallback(() => dialogo.current?.close(), []);
  return (
    <div className={className}>
      <button
        type="button"
        aria-label={`Abrir ${etiqueta.toLowerCase()}`}
        aria-haspopup="dialog"
        onClick={() => dialogo.current?.showModal()}
        className="grid size-11 place-items-center rounded-full text-blanco transition-colors duration-200 hover:bg-campo"
      >
        <svg viewBox="0 0 20 14" aria-hidden="true" className="h-3.5 w-5">
          <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        className="lateral menu-movil"
        onClick={(evento) => {
          // Tocar fuera del panel, o elegir un enlace o un botón de envío, cierra el menú.
          const destino = evento.target as HTMLElement;
          if (destino === dialogo.current || destino.closest('a, button[type="submit"]')) cerrar();
        }}
      >
        <div className="grid h-full grid-rows-[auto_1fr] overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between gap-4 px-6 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-4">
            <h2 id={idTitulo} className="sr-only">
              {etiqueta}
            </h2>
            {cabecera ?? <span />}
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar el menú"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-campo text-blanco transition-colors duration-200 hover:bg-campo-foco"
            >
              <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          <div
            className={cx(
              'grid content-start gap-8 px-6 pt-6 pb-[calc(32px+env(safe-area-inset-bottom,0px))]',
            )}
          >
            {children}
          </div>
        </div>
      </dialog>
    </div>
  );
}
