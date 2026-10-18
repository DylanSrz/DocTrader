'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
} from 'react';
import { cx } from '@/components/ui';

const CerrarLateral = createContext<() => void>(() => {});

/** Para que un formulario dentro del panel lateral lo cierre al terminar. */
export function useCerrarLateral() {
  return useContext(CerrarLateral);
}

const clasesEnlace =
  'inline-flex min-h-11 items-center text-sm font-normal text-blanco underline decoration-white/35 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-current';
const clasesPildora =
  'inline-flex min-h-[46px] items-center justify-center rounded-pildora bg-llama px-[22px] py-3.5 texto-menu text-vacio select-none transition-[transform,background-color] duration-200 ease-salida active:scale-[0.97] hover:bg-llama-viva motion-reduce:transition-none';

/**
 * Panel lateral (propuesta 2): un `<dialog>` modal que entra desde la derecha. Al cerrarse, el navegador devuelve
 * el foco al botón que lo abrió. Se cierra con Escape, con la X o tocando fuera.
 */
export function Lateral({
  titulo,
  boton,
  variante = 'enlace',
  gris = false,
  abiertoAlInicio = false,
  children,
}: {
  titulo: string;
  boton: ReactNode;
  variante?: 'enlace' | 'pildora';
  gris?: boolean;
  /** Se abre solo al cargar (por ejemplo, la compra que se pidió desde la landing con `?comprar=`). */
  abiertoAlInicio?: boolean;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const router = useRouter();
  const cerrar = useCallback(() => dialogo.current?.close(), []);
  useEffect(() => {
    if (!abiertoAlInicio || dialogo.current?.open) return;
    dialogo.current?.showModal();
    // Se quita el parámetro de la URL: al recargar o volver no se abre otra vez.
    router.replace(window.location.pathname, { scroll: false });
  }, [abiertoAlInicio, router]);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={cx(
          variante === 'pildora' ? clasesPildora : clasesEnlace,
          gris && 'text-ceniza hover:text-blanco',
        )}
      >
        {boton}
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        className="lateral"
        onClick={(evento) => {
          if (evento.target === dialogo.current) cerrar();
        }}
      >
        <div className="grid h-full grid-rows-[auto_1fr]">
          <div className="flex items-start justify-between gap-4 px-8 pt-[calc(28px+env(safe-area-inset-top,0px))] pb-2 max-sm:px-5">
            <h2
              id={idTitulo}
              className="text-[clamp(32px,5vw,44px)] leading-[1.05] tracking-[-0.04em]"
            >
              {titulo}
            </h2>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="grid size-[46px] shrink-0 place-items-center rounded-full bg-campo text-blanco transition-colors duration-200 hover:bg-campo-foco"
            >
              <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          <CerrarLateral value={cerrar}>{children}</CerrarLateral>
        </div>
      </dialog>
    </>
  );
}

/** Cuerpo del formulario del panel lateral: se desplaza solo él. */
export function CuerpoLateral({ children }: { children: ReactNode }) {
  return (
    <div className="grid content-start gap-[22px] overflow-y-auto overscroll-contain px-8 pt-6 pb-8 max-sm:px-5">
      {children}
    </div>
  );
}

/** Pie del panel lateral: la acción principal a la derecha. */
export function PieLateral({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 px-8 pt-[18px] pb-[calc(22px+env(safe-area-inset-bottom,0px))] max-sm:px-5">
      {children}
    </div>
  );
}

/**
 * Panel lateral que ya viene abierto porque la URL lo pide (`?ficha=…`). Al cerrarlo, vuelve a la URL sin él y
 * devuelve el foco al enlace que lo abrió (`idOrigen`).
 */
export function LateralAbierto({
  titulo,
  subtitulo,
  cerrarEn,
  idOrigen,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  /** La URL de la lista, sin el panel. */
  cerrarEn: string;
  idOrigen?: string;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const router = useRouter();
  useEffect(() => {
    const nodo = dialogo.current;
    if (nodo && !nodo.open) nodo.showModal();
  }, []);
  const cerrar = useCallback(() => dialogo.current?.close(), []);
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      className="lateral"
      onClose={() => {
        router.replace(cerrarEn, { scroll: false });
        if (idOrigen) requestAnimationFrame(() => document.getElementById(idOrigen)?.focus());
      }}
      onClick={(evento) => {
        if (evento.target === dialogo.current) cerrar();
      }}
    >
      <div className="grid h-full grid-rows-[auto_1fr]">
        <div className="flex items-start justify-between gap-4 px-8 pt-[calc(28px+env(safe-area-inset-top,0px))] pb-2 max-sm:px-5">
          <div className="grid gap-1.5">
            <h2
              id={idTitulo}
              className="text-[clamp(32px,5vw,44px)] leading-[1.05] tracking-[-0.04em]"
            >
              {titulo}
            </h2>
            {subtitulo ? <p className="text-sm text-ceniza">{subtitulo}</p> : null}
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="grid size-[46px] shrink-0 place-items-center rounded-full bg-campo text-blanco transition-colors duration-200 hover:bg-campo-foco"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <CerrarLateral value={cerrar}>
          <div className="grid content-start gap-[clamp(40px,5vw,56px)] overflow-y-auto overscroll-contain px-8 pt-6 pb-[calc(40px+env(safe-area-inset-bottom,0px))] max-sm:px-5">
            {children}
          </div>
        </CerrarLateral>
      </div>
    </dialog>
  );
}
