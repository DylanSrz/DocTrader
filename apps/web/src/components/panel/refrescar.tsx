'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a pedir la página cada cierto tiempo (por ejemplo, mientras se verifica un pago). */
export function Refrescar({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const reloj = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, segundos * 1000);
    return () => clearInterval(reloj);
  }, [router, segundos]);
  return null;
}
