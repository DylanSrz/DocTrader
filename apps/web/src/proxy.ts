import { type NextRequest, NextResponse } from 'next/server';

/**
 * Atajo de la vista: sin la cookie de sesión, los paneles mandan directo a ingresar. La revisión de verdad la
 * hace la API en cada petición (la cookie puede existir y estar vencida).
 */
export function proxy(peticion: NextRequest) {
  const tieneSesion = peticion.cookies.has('__Host-sesion') || peticion.cookies.has('sesion');
  if (!tieneSesion) return NextResponse.redirect(new URL('/ingresar', peticion.url));
  return NextResponse.next();
}

export const config = { matcher: ['/panel/:path*', '/admin/:path*'] };
