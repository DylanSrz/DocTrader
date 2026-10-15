'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function restante(expiraEn: number): number {
  return Math.max(0, Math.round((expiraEn - Date.now()) / 1000));
}

/**
 * Cuenta regresiva de la orden, a 180 px (el protagonista de Pagos). En los últimos 10 minutos se pone naranja;
 * al llegar a cero vuelve a pedir la página, que ya muestra la orden expirada.
 */
export function Regresiva({ expiraEn }: { expiraEn: string }) {
  const fin = new Date(expiraEn).getTime();
  const router = useRouter();
  const [segundos, setSegundos] = useState(() => restante(fin));
  useEffect(() => {
    const reloj = setInterval(() => {
      const quedan = restante(fin);
      setSegundos(quedan);
      if (quedan === 0) {
        clearInterval(reloj);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(reloj);
  }, [fin, router]);
  const minutos = Math.floor(segundos / 60);
  const texto = `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
  return (
    <div className="grid gap-2">
      <strong
        suppressHydrationWarning
        data-urgente={segundos < 600}
        className="cifra text-[clamp(88px,13vw,180px)] leading-[0.85] font-light tracking-[-0.06em] data-[urgente=true]:text-llama"
      >
        {texto}
      </strong>
      {/* Para lectores de pantalla, un texto que no cambia cada segundo. */}
      <span className="text-sm text-ceniza">
        Tiempo que queda.{' '}
        {segundos === 0 ? 'La orden expiró.' : 'Si se acaba, crea una orden nueva.'}
      </span>
    </div>
  );
}
