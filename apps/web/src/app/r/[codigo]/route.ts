import { normalizarCodigo } from '@doctrader/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { recordarCodigo } from '@/lib/referidos';

/**
 * Enlace de referido (`/r/CODIGO`): guarda el código en una cookie de 30 días y lleva al registro, que muestra quién
 * invitó. Un código mal escrito lleva igual al registro, sin cookie: el registro nunca se bloquea por esto.
 */
export async function GET(
  peticion: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const codigo = normalizarCodigo((await params).codigo);
  if (codigo) await recordarCodigo(codigo);
  return NextResponse.redirect(new URL('/registro', peticion.url), 303);
}
