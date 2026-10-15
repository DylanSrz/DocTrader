import { DOCUMENTOS_LEGALES, type TipoDocumentoLegal } from '@doctrader/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Etiqueta } from '@/components/ui';
import { markdownAHtml } from '@/lib/markdown';
import { obtenerTextoLegal } from '@/lib/publico';

/**
 * Textos legales: la versión vigente que se publicó desde el panel (`legal_documents`). Quedan en caché y se
 * vuelven a armar cuando el admin publica una versión nueva.
 */
const TIPOS = Object.keys(DOCUMENTOS_LEGALES) as TipoDocumentoLegal[];
const tipoDeRuta = (ruta: string) => TIPOS.find((t) => DOCUMENTOS_LEGALES[t].ruta === ruta);

const fecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

export function generateStaticParams() {
  return TIPOS.map((t) => ({ documento: DOCUMENTOS_LEGALES[t].ruta }));
}

export async function generateMetadata({
  params,
}: PageProps<'/legal/[documento]'>): Promise<Metadata> {
  const tipo = tipoDeRuta((await params).documento);
  return { title: tipo ? DOCUMENTOS_LEGALES[tipo].titulo : undefined };
}

export default async function DocumentoLegal({ params }: PageProps<'/legal/[documento]'>) {
  const tipo = tipoDeRuta((await params).documento);
  if (!tipo) notFound();
  const texto = await obtenerTextoLegal(tipo);
  return (
    <article className="grid max-w-[46rem] gap-10">
      <div className="grid gap-6">
        <Etiqueta>
          Versión {texto.version}
          {texto.publicadoEn ? ` · publicada el ${fecha.format(new Date(texto.publicadoEn))}` : ''}
        </Etiqueta>
        <h1 className="text-grande">{DOCUMENTOS_LEGALES[tipo].titulo}</h1>
      </div>
      {/* Markdown del panel de admin, convertido sin HTML (ver lib/markdown.ts). */}
      <div className="prosa" dangerouslySetInnerHTML={{ __html: markdownAHtml(texto.contenido) }} />
    </article>
  );
}
