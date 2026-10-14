'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (elemento: HTMLElement, opciones: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const CLAVE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Desafío de Cloudflare Turnstile (sin imágenes que resolver). Pone su respuesta en el campo `turnstile` del
 * formulario. Si no hay clave configurada, no se muestra nada (la API tampoco lo pide).
 * Cada respuesta sirve una sola vez: el formulario lo vuelve a montar (con `key`) después de cada envío.
 */
export function Turnstile() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [cargado, setCargado] = useState(() => typeof window !== 'undefined' && !!window.turnstile);

  useEffect(() => {
    if (!CLAVE || !cargado || !contenedor.current || !window.turnstile) return;
    const id = window.turnstile.render(contenedor.current, {
      sitekey: CLAVE,
      theme: 'dark',
      language: 'es',
      'response-field-name': 'turnstile',
    });
    return () => window.turnstile?.remove(id);
  }, [cargado]);

  if (!CLAVE) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setCargado(true)}
      />
      <div ref={contenedor} className="min-h-[65px]" />
    </>
  );
}
