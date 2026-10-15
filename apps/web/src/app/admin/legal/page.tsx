import { DOCUMENTOS_LEGALES, type TipoDocumentoLegal } from '@doctrader/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Textos legales' };

interface Vigente {
  tipo: TipoDocumentoLegal;
  version: number;
  publicadoEn: string;
}

const fecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

async function Lista() {
  await requerirSesion('ADMIN');
  const respuesta = await llamarApi<(Vigente | null)[]>('/admin/legal', {
    token: await tokenDeSesion(),
  });
  const vigentes = respuesta.ok ? respuesta.datos.filter((d): d is Vigente => d !== null) : [];
  return (
    <ul className="grid gap-2">
      {(Object.keys(DOCUMENTOS_LEGALES) as TipoDocumentoLegal[]).map((tipo) => {
        const doc = vigentes.find((d) => d.tipo === tipo);
        return (
          <li key={tipo}>
            <Link
              href={`/admin/legal/${DOCUMENTOS_LEGALES[tipo].ruta}`}
              className="group flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 py-4"
            >
              <span className="text-medio underline decoration-white/0 underline-offset-[6px] transition-colors group-hover:decoration-white/35">
                {DOCUMENTOS_LEGALES[tipo].titulo}
              </span>
              <span className="text-sm text-ceniza">
                {doc
                  ? `Versión ${doc.version} · ${fecha.format(new Date(doc.publicadoEn))}`
                  : 'Sin publicar'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function TextosLegales() {
  return (
    <div className="grid gap-12">
      <div className="grid gap-6">
        <Etiqueta>Página pública</Etiqueta>
        <h1 className="max-w-[16ch] text-grande">Textos legales.</h1>
        <p className="max-w-[36em] text-niebla">
          Cada cambio se publica como una versión nueva; las anteriores se guardan, porque cada
          cliente aceptó una versión concreta al registrarse. Conviene que un abogado revise los
          cambios antes de publicarlos.
        </p>
      </div>
      <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
        <Lista />
      </Suspense>
    </div>
  );
}
