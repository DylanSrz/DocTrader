import { DOCUMENTOS_LEGALES, sustituirPrecios, type TipoDocumentoLegal } from '@doctrader/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Etiqueta } from '@/components/ui';
import { markdownAHtml } from '@/lib/markdown';
import { obtenerLanding, obtenerTextoLegal } from '@/lib/publico';

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

/** Resumen de cada documento: descripción para buscadores y para la vista previa al compartir el enlace. */
const RESUMEN: Record<TipoDocumentoLegal, string> = {
  TERMS: 'Qué incluye la licencia de DocTraderPRO, precios, pagos y renovaciones.',
  PRIVACY: 'Qué datos guarda DocTraderPRO, para qué los usa y cómo los protege.',
  RISK: 'Operar en mercados financieros implica riesgo de pérdida: lo que debes saber antes de empezar.',
};

export async function generateMetadata({
  params,
}: PageProps<'/legal/[documento]'>): Promise<Metadata> {
  const tipo = tipoDeRuta((await params).documento);
  if (!tipo) return {};
  const { ruta, titulo } = DOCUMENTOS_LEGALES[tipo];
  // Imagen propia de cada documento al compartirlo (public/compartir/legal-<ruta>.png, 1200 × 630).
  const imagen = {
    url: `/compartir/legal-${ruta}.png`,
    width: 1200,
    height: 630,
    alt: `DocTraderPRO: ${titulo}`,
  };
  return {
    title: titulo,
    description: RESUMEN[tipo],
    alternates: { canonical: `/legal/${ruta}` },
    openGraph: {
      type: 'article',
      siteName: 'DocTraderPRO',
      locale: 'es_CO',
      url: `/legal/${ruta}`,
      title: `${titulo} · DocTraderPRO`,
      description: RESUMEN[tipo],
      images: [imagen],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titulo} · DocTraderPRO`,
      description: RESUMEN[tipo],
      images: [imagen],
    },
  };
}

export default async function DocumentoLegal({ params }: PageProps<'/legal/[documento]'>) {
  const tipo = tipoDeRuta((await params).documento);
  if (!tipo) notFound();
  const [texto, { planes }] = await Promise.all([obtenerTextoLegal(tipo), obtenerLanding()]);
  // Los precios salen de la tabla de planes (la misma de la landing y del pago), no del texto publicado.
  const contenido = sustituirPrecios(texto.contenido, planes);
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
      <div className="prosa" dangerouslySetInnerHTML={{ __html: markdownAHtml(contenido) }} />
    </article>
  );
}
