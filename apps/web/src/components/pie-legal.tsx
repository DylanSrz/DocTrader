import Link from 'next/link';

/** Pie de las páginas de acceso y de los paneles: qué es (y qué no es) DocTraderPRO, y los textos legales. */
export function PieLegal() {
  return (
    <footer className="contenedor grid gap-4 pt-10 pb-[calc(env(safe-area-inset-bottom,0px)+40px)] text-sm text-ceniza">
      <p className="max-w-[60em]">
        <span translate="no">DocTraderPRO</span> vende una licencia de uso de software. No es
        asesoría de inversión ni administra tu dinero. Operar en los mercados financieros tiene un
        riesgo alto y puedes perder todo tu capital.
      </p>
      <nav aria-label="Textos legales" className="flex flex-wrap gap-x-6">
        <Link
          className="inline-flex min-h-11 items-center hover:text-blanco"
          href="/legal/terminos"
        >
          Términos
        </Link>
        <Link className="inline-flex min-h-11 items-center hover:text-blanco" href="/legal/datos">
          Tratamiento de datos
        </Link>
        <Link className="inline-flex min-h-11 items-center hover:text-blanco" href="/legal/riesgo">
          Aviso de riesgo
        </Link>
      </nav>
    </footer>
  );
}
