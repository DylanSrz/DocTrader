import { DOCUMENTOS_LEGALES, type TipoDocumentoLegal } from '@doctrader/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Enlace, Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { EditorLegal } from './editor';

export const metadata: Metadata = { title: 'Editar texto legal' };

const TIPOS = Object.keys(DOCUMENTOS_LEGALES) as TipoDocumentoLegal[];

async function Editor({ params }: { params: PageProps<'/admin/legal/[documento]'>['params'] }) {
  await requerirSesion('ADMIN');
  const { documento } = await params;
  const tipo = TIPOS.find((t) => DOCUMENTOS_LEGALES[t].ruta === documento);
  if (!tipo) notFound();
  const respuesta = await llamarApi<
    ({ tipo: string; version: number; contenido: string } | null)[]
  >('/admin/legal', { token: await tokenDeSesion() });
  const vigente = respuesta.ok ? respuesta.datos.find((d) => d?.tipo === tipo) : undefined;
  return (
    <>
      <div className="grid gap-6">
        <Etiqueta>
          {vigente ? `Versión vigente: ${vigente.version}` : 'Todavía sin publicar'}
        </Etiqueta>
        <h1 className="max-w-[18ch] text-grande">{DOCUMENTOS_LEGALES[tipo].titulo}</h1>
        <div className="flex flex-wrap gap-x-8">
          <Enlace href={`/legal/${DOCUMENTOS_LEGALES[tipo].ruta}`} target="_blank" gris>
            Ver la página pública
          </Enlace>
          <Enlace href="/admin/legal" gris>
            Volver a los textos legales
          </Enlace>
        </div>
      </div>
      <EditorLegal
        tipo={tipo}
        contenido={vigente?.contenido ?? ''}
        siguienteVersion={(vigente?.version ?? 0) + 1}
      />
    </>
  );
}

export default function EditarTextoLegal({ params }: PageProps<'/admin/legal/[documento]'>) {
  return (
    <div className="grid gap-12">
      <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}
