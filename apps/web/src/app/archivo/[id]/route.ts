import { type NextRequest, NextResponse } from 'next/server';
import { llamarApi } from '@/lib/api';
import { tokenDeSesion } from '@/lib/sesion';

/**
 * Descarga de un adjunto: la API revisa que quien lo pide pueda verlo y da un enlace firmado de 5 minutos al
 * almacenamiento privado. El archivo no pasa por aquí (Vercel no deja responder más de 4,5 MB).
 */
export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await tokenDeSesion();
  if (!token) return NextResponse.redirect(new URL('/ingresar', peticion.url));
  const sinArchivo = new NextResponse('No encontramos ese archivo o ya no tienes acceso.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return sinArchivo;
  const r = await llamarApi<{ url: string }>(`/archivos/${id}/enlace`, { token });
  if (!r.ok) {
    return r.estado === 404
      ? sinArchivo
      : new NextResponse(r.error.mensaje, {
          status: r.estado,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        });
  }
  const respuesta = NextResponse.redirect(r.datos.url, 302);
  respuesta.headers.set('cache-control', 'no-store');
  return respuesta;
}
