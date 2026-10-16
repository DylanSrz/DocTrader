import Link from 'next/link';
import { Suspense } from 'react';
import { inicioDe, obtenerSesion } from '@/lib/sesion';

async function Destino({ className }: { className: string }) {
  const sesion = await obtenerSesion();
  if (sesion?.estado !== 'COMPLETA') return <Ingresar className={className} />;
  return (
    <Link href={inicioDe(sesion.usuario.rol)} className={className}>
      Mi panel
    </Link>
  );
}

function Ingresar({ className }: { className: string }) {
  return (
    <Link href="/ingresar" className={className}>
      Ingresar
    </Link>
  );
}

/**
 * "Ingresar" o, si ya hay una sesión, "Mi panel". La landing es estática: solo este enlace se resuelve por petición
 * (y sin cookie no consulta la API).
 */
export function EnlacePanel({ className }: { className: string }) {
  return (
    <Suspense fallback={<Ingresar className={className} />}>
      <Destino className={className} />
    </Suspense>
  );
}
