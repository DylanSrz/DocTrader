'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export interface Diapositiva {
  /** Nombre corto: para lectores de pantalla y el contador. */
  titulo: string;
  /** Qué decir en esta diapositiva (tecla N). Solo las ve quien presenta. */
  notas: string;
  contenido: ReactNode;
}

const SIGUIENTE = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
/** Lo que hay que deslizar el dedo (px) para cambiar de diapositiva. */
const DESLIZAR = 50;

/** Si el foco o el toque está en un campo de texto o una lista (la calculadora). */
function enUnCampo(objetivo: EventTarget | null): boolean {
  return objetivo instanceof HTMLElement && Boolean(objetivo.closest('input, select, textarea'));
}

/** El número de diapositiva de la URL (`#3` → índice 2), si existe. */
function desdeLaUrl(total: number): number | null {
  const n = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isInteger(n) && n >= 1 && n <= total ? n - 1 : null;
}

/**
 * Visor de la presentación de ventas (`/presentacion`): una diapositiva a la vez, a pantalla completa.
 * - Teclado: flechas, espacio, Enter y Re Pág/Av Pág para avanzar o volver; Inicio y Fin; N muestra las notas; F,
 *   pantalla completa. En tablet y celular, deslizar el dedo. Dentro de un campo (la calculadora) las teclas y el
 *   dedo son del campo.
 * - La URL lleva el número (`#3`): se puede abrir o recargar en una diapositiva concreta.
 * - Las diapositivas inactivas quedan `inert` (fuera del tabulador y de los lectores de pantalla).
 * - Al imprimir (o "Guardar PDF") salen todas, una por página de 16:9 (estilos `.presentacion` en globals.css).
 */
export function Visor({ diapositivas }: { diapositivas: Diapositiva[] }) {
  const total = diapositivas.length;
  const [actual, setActual] = useState(0);
  const [notas, setNotas] = useState(false);
  const [completa, setCompleta] = useState(false);
  const inicioToque = useRef<{ x: number; y: number } | null>(null);

  const ir = useCallback(
    (indice: number) => {
      const destino = Math.min(Math.max(indice, 0), total - 1);
      setActual(destino);
      window.history.replaceState(null, '', `#${destino + 1}`);
    },
    [total],
  );

  // La diapositiva de la URL al abrir, y si alguien cambia el número a mano.
  useEffect(() => {
    const desdeUrl = () => {
      const indice = desdeLaUrl(total);
      if (indice !== null) setActual(indice);
    };
    desdeUrl();
    window.addEventListener('hashchange', desdeUrl);
    return () => window.removeEventListener('hashchange', desdeUrl);
  }, [total]);

  const pantallaCompleta = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const alCambiar = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      // Al escribir en la calculadora, las teclas son del campo, no de la presentación.
      if (enUnCampo(evento.target)) return;
      // Enter y espacio sobre un botón o enlace hacen lo de ese botón o enlace.
      const sobreControl = (evento.target as HTMLElement | null)?.closest('button, a');
      if (sobreControl && (evento.key === 'Enter' || evento.key === ' ')) return;
      if (SIGUIENTE.has(evento.key)) ir(actual + 1);
      else if (ANTERIOR.has(evento.key)) ir(actual - 1);
      else if (evento.key === 'Home') ir(0);
      else if (evento.key === 'End') ir(total - 1);
      else if (evento.key === 'n' || evento.key === 'N') setNotas((v) => !v);
      else if (evento.key === 'f' || evento.key === 'F') pantallaCompleta();
      else return;
      evento.preventDefault();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [actual, ir, total, pantallaCompleta]);

  return (
    <div
      className="presentacion"
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' && !enUnCampo(e.target))
          inicioToque.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const inicio = inicioToque.current;
        inicioToque.current = null;
        if (!inicio || e.pointerType !== 'touch') return;
        const dx = e.clientX - inicio.x;
        if (Math.abs(dx) < DESLIZAR || Math.abs(dx) < Math.abs(e.clientY - inicio.y)) return;
        ir(dx < 0 ? actual + 1 : actual - 1);
      }}
    >
      {/* Solo esta página imprime en 16:9 (1600 × 900): el resto del sitio usa la hoja normal. */}
      <style>{'@page { size: 1600px 900px; margin: 0; }'}</style>
      <div
        className="presentacion-progreso"
        role="progressbar"
        aria-label="Avance de la presentación"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={actual + 1}
      >
        <span style={{ transform: `scaleX(${(actual + 1) / total})` }} />
      </div>

      <main className="presentacion-lamina" aria-roledescription="presentación">
        {diapositivas.map((d, i) => (
          <section
            key={d.titulo}
            className="diapositiva"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${total}: ${d.titulo}`}
            data-activa={i === actual || undefined}
            inert={i !== actual}
          >
            {d.contenido}
          </section>
        ))}
      </main>

      {notas ? (
        <aside className="presentacion-notas" aria-label="Notas para quien presenta">
          <p className="texto-menu text-llama">Notas · {diapositivas[actual]?.titulo}</p>
          <p>{diapositivas[actual]?.notas}</p>
        </aside>
      ) : null}

      <nav className="presentacion-controles" aria-label="Controles de la presentación">
        <button
          type="button"
          onClick={() => ir(actual - 1)}
          disabled={actual === 0}
          aria-label="Diapositiva anterior"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <span className="cifra" aria-live="polite">
          {actual + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => ir(actual + 1)}
          disabled={actual === total - 1}
          aria-label="Diapositiva siguiente"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <span className="presentacion-separador" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setNotas((v) => !v)}
          aria-pressed={notas}
          title="Notas (N)"
        >
          Notas
        </button>
        <button
          type="button"
          onClick={pantallaCompleta}
          aria-pressed={completa}
          title="Pantalla completa (F)"
        >
          {completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
        <button type="button" onClick={() => window.print()} title="Guardar como PDF o imprimir">
          Guardar PDF
        </button>
      </nav>
    </div>
  );
}
