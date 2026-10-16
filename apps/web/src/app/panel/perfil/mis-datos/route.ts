import { type NextRequest, NextResponse } from 'next/server';
import { llamarApi } from '@/lib/api';
import { tokenDeSesion } from '@/lib/sesion';

/** "Descargar mis datos": la copia de los datos del cliente, como archivo JSON (Ley 1581, derecho de acceso). */
export async function GET(peticion: NextRequest) {
  const token = await tokenDeSesion();
  if (!token) return NextResponse.redirect(new URL('/ingresar', peticion.url));
  const r = await llamarApi<unknown>('/privacidad/mis-datos', { token });
  if (!r.ok) {
    return new NextResponse(r.error.mensaje, {
      status: r.estado,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(r.datos, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="doctraderpro-mis-datos-${fecha}.json"`,
      'cache-control': 'no-store',
    },
  });
}
