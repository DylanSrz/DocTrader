import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { Etiqueta } from '@/components/ui';

/**
 * Textos legales. Por ahora salen de `docs/legal/` al compilar; en la etapa 2 pasan a la tabla `legal_documents`
 * para que Argemiro los actualice sin tocar código.
 */
const DOCUMENTOS = {
  terminos: { archivo: 'terminos-licencia.md', titulo: 'Términos de la licencia' },
  datos: { archivo: 'politica-datos.md', titulo: 'Tratamiento de datos personales' },
  riesgo: { archivo: 'aviso-riesgo.md', titulo: 'Aviso de riesgo' },
} as const;
type Documento = keyof typeof DOCUMENTOS;

export function generateStaticParams() {
  return Object.keys(DOCUMENTOS).map((documento) => ({ documento }));
}

export async function generateMetadata({
  params,
}: PageProps<'/legal/[documento]'>): Promise<Metadata> {
  const { documento } = await params;
  return { title: DOCUMENTOS[documento as Documento]?.titulo };
}

/** El HTML del documento, sin el título (va aparte) ni la nota interna del borrador que abre cada archivo. */
async function contenido(documento: Documento): Promise<string> {
  'use cache';
  cacheLife('max');
  const ruta = path.join(process.cwd(), '..', '..', 'docs', 'legal', DOCUMENTOS[documento].archivo);
  const markdown = await readFile(ruta, 'utf8');
  const sinTitulo = markdown.replace(/^# .*\n+/, '').replace(/^(>.*\n)+\n*/, '');
  return marked.parse(sinTitulo, { async: false });
}

export default async function DocumentoLegal({ params }: PageProps<'/legal/[documento]'>) {
  const { documento } = await params;
  if (!(documento in DOCUMENTOS)) notFound();
  const html = await contenido(documento as Documento);
  return (
    <article className="grid max-w-[46rem] gap-10">
      <div className="grid gap-6">
        <Etiqueta>Borrador · versión del 14 de octubre de 2026</Etiqueta>
        <h1 className="text-grande">{DOCUMENTOS[documento as Documento].titulo}</h1>
      </div>
      {/* Texto nuestro (docs/legal), no del usuario. */}
      <div className="prosa" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
