'use client';

import { useEffect, useRef } from 'react';
import { ALTO_LOGO, ANCHO_LOGO, PUNTOS_LOGO } from './puntos-logo';

/** Rojo del cerebro, naranja de barras y flecha, verde limón (chispa) y blanco. */
const COLORES = ['#E2531F', '#FB9819', '#DDDB65', '#FFFFFF'];

interface Particula {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  tam: number;
  giro: number;
  vg: number;
  fase: number;
  color: number;
  alfa: number;
  retraso: number;
  deriva?: number;
  dx: number;
  dy: number;
}

const azar = (a: number, b: number) => a + Math.random() * (b - a);
const facilidad = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * El gesto de la landing (propuesta 2): el logo hecho de triángulos que se ensamblan una sola vez al cargar y
 * después respiran. Con el mouse, el puntero aparta las partículas cercanas. Se detiene fuera de pantalla o con la
 * pestaña oculta, y con "reducir movimiento" aparece completo y quieto.
 */
export function Particulas({
  logo = false,
  sueltas = 0,
  puntero = false,
  className,
  etiqueta,
}: {
  logo?: boolean;
  sueltas?: number | { celular: number; escritorio: number };
  puntero?: boolean;
  className?: string;
  /** Descripción para lectores de pantalla; sin ella, el canvas queda oculto para ellos. */
  etiqueta?: string;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cantidadSueltas =
      typeof sueltas === 'number'
        ? sueltas
        : window.innerWidth < 700
          ? sueltas.celular
          : sueltas.escritorio;
    let particulas: Particula[] = [];
    let ancho = 0;
    let alto = 0;
    let visible = true;
    let cuadro = 0;
    const posPuntero = { x: -9999, y: -9999 };
    const inicio = performance.now();

    function construir() {
      const caja = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = caja.width;
      alto = caja.height;
      canvas!.width = Math.round(ancho * dpr);
      canvas!.height = Math.round(alto * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      particulas = [];
      if (logo) {
        const esc = Math.min(ancho / ANCHO_LOGO, alto / ALTO_LOGO) * 0.8;
        const ox = (ancho - ANCHO_LOGO * esc) / 2;
        const oy = (alto - ALTO_LOGO * esc) / 2;
        for (let i = 0; i < PUNTOS_LOGO.length; i += 6) {
          const x = parseInt(PUNTOS_LOGO.substring(i, i + 2), 16);
          const y = parseInt(PUNTOS_LOGO.substring(i + 2, i + 5), 16);
          const base = Number(PUNTOS_LOGO[i + 5]);
          const color = Math.random() < 0.06 ? 2 : Math.random() < 0.03 ? 3 : base;
          const ang = azar(0, Math.PI * 2);
          const dist = azar(0.35, 0.9) * Math.max(ancho, alto);
          particulas.push({
            tx: ox + x * esc + azar(-1, 1),
            ty: oy + y * esc + azar(-1, 1),
            sx: ancho / 2 + Math.cos(ang) * dist,
            sy: alto / 2 + Math.sin(ang) * dist,
            tam: azar(1.4, 3) * Math.max(esc / 1.6, 0.75),
            giro: azar(0, 6.28),
            vg: azar(-0.4, 0.4),
            fase: azar(0, 6.28),
            color,
            alfa: azar(0.7, 1),
            retraso: azar(0, 650),
            dx: 0,
            dy: 0,
          });
        }
      }
      for (let k = 0; k < cantidadSueltas; k++) {
        const px = azar(0, ancho);
        const py = azar(0, alto);
        particulas.push({
          tx: px,
          ty: py,
          sx: px,
          sy: py,
          tam: azar(1.4, 3),
          giro: azar(0, 6.28),
          vg: azar(-0.3, 0.3),
          fase: azar(0, 6.28),
          color: [0, 1, 2, 1][k % 4]!,
          alfa: azar(0.15, 0.45),
          retraso: 0,
          deriva: azar(4, 14),
          dx: 0,
          dy: 0,
        });
      }
    }

    function pintar(ahora: number) {
      const t = ahora - inicio;
      const quieto = reducir.matches;
      ctx!.clearRect(0, 0, ancho, alto);
      ctx!.lineWidth = 1;
      for (let c = 0; c < COLORES.length; c++) {
        ctx!.strokeStyle = COLORES[c]!;
        for (const p of particulas) {
          if (p.color !== c) continue;
          const avance = quieto ? 1 : Math.min(1, Math.max(0, (t - p.retraso) / 1500));
          const e = facilidad(avance);
          let x = p.sx + (p.tx - p.sx) * e;
          let y = p.sy + (p.ty - p.sy) * e;
          if (!quieto) {
            const amp = p.deriva ?? 1.2;
            x += Math.sin(t / 2400 + p.fase) * amp * (p.deriva ? 1 : e);
            y += Math.cos(t / 2900 + p.fase) * amp * (p.deriva ? 1 : e);
            // El puntero aparta las partículas cercanas; vuelven solas.
            const ddx = x - posPuntero.x;
            const ddy = y - posPuntero.y;
            const d2 = ddx * ddx + ddy * ddy;
            let fx = 0;
            let fy = 0;
            if (d2 < 3600) {
              const d = Math.sqrt(d2) || 1;
              const f = ((60 - d) / 60) * 18;
              fx = (ddx / d) * f;
              fy = (ddy / d) * f;
            }
            p.dx += (fx - p.dx) * 0.12;
            p.dy += (fy - p.dy) * 0.12;
            x += p.dx;
            y += p.dy;
          }
          const giro = p.giro + (quieto ? 0 : (t / 1000) * p.vg);
          ctx!.globalAlpha = p.alfa * (0.25 + 0.75 * e);
          ctx!.beginPath();
          ctx!.moveTo(x + p.tam * Math.cos(giro), y + p.tam * Math.sin(giro));
          ctx!.lineTo(x + p.tam * Math.cos(giro + 2.094), y + p.tam * Math.sin(giro + 2.094));
          ctx!.lineTo(x + p.tam * Math.cos(giro + 4.189), y + p.tam * Math.sin(giro + 4.189));
          ctx!.closePath();
          ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;
    }

    function bucle(ahora: number) {
      pintar(ahora);
      cuadro = !reducir.matches && visible && !document.hidden ? requestAnimationFrame(bucle) : 0;
    }
    const arrancar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(bucle);
    };

    construir();
    arrancar();

    const alCambiarTamano = new ResizeObserver(() => {
      construir();
      if (reducir.matches) pintar(inicio + 99_999);
      arrancar();
    });
    alCambiarTamano.observe(canvas);
    const alVerse = new IntersectionObserver((entradas) => {
      visible = entradas[0]?.isIntersecting ?? true;
      if (visible) arrancar();
    });
    alVerse.observe(canvas);
    const alVolver = () => {
      if (!document.hidden) arrancar();
    };
    document.addEventListener('visibilitychange', alVolver);
    const alCambiarMovimiento = () => {
      arrancar();
      pintar(performance.now());
    };
    reducir.addEventListener('change', alCambiarMovimiento);

    const contenedor = canvas.parentElement;
    const conMouse = puntero && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mover = (ev: PointerEvent) => {
      const caja = canvas.getBoundingClientRect();
      posPuntero.x = ev.clientX - caja.left;
      posPuntero.y = ev.clientY - caja.top;
    };
    const salir = () => {
      posPuntero.x = -9999;
      posPuntero.y = -9999;
    };
    if (conMouse && contenedor) {
      contenedor.addEventListener('pointermove', mover);
      contenedor.addEventListener('pointerleave', salir);
    }

    return () => {
      cancelAnimationFrame(cuadro);
      alCambiarTamano.disconnect();
      alVerse.disconnect();
      document.removeEventListener('visibilitychange', alVolver);
      reducir.removeEventListener('change', alCambiarMovimiento);
      if (conMouse && contenedor) {
        contenedor.removeEventListener('pointermove', mover);
        contenedor.removeEventListener('pointerleave', salir);
      }
    };
  }, [logo, sueltas, puntero]);

  return etiqueta ? (
    <canvas ref={lienzo} role="img" aria-label={etiqueta} className={className} />
  ) : (
    <canvas ref={lienzo} aria-hidden="true" className={className} />
  );
}
