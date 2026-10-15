import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

const produccion = process.env.NODE_ENV === 'production';

/**
 * Cookie de la sesión. `__Host-` obliga a que sea segura, de este dominio exacto y para todo el sitio; en
 * desarrollo (http) no se puede usar ese prefijo.
 */
export const COOKIE_SESION = produccion ? '__Host-sesion' : 'sesion';
/** Identificador aleatorio del navegador, para avisar de ingresos desde uno nuevo. */
const COOKIE_DISPOSITIVO = produccion ? '__Host-dispositivo' : 'dispositivo';

export async function guardarSesion(token: string, expiraEn: number): Promise<void> {
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: produccion,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiraEn),
  });
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
}

/** El identificador de este navegador; lo crea la primera vez. */
export async function identificadorDelNavegador(): Promise<string> {
  const almacen = await cookies();
  const actual = almacen.get(COOKIE_DISPOSITIVO)?.value;
  if (actual && /^[A-Za-z0-9_-]{16,64}$/.test(actual)) return actual;
  const nuevo = randomBytes(24).toString('base64url');
  almacen.set(COOKIE_DISPOSITIVO, nuevo, {
    httpOnly: true,
    secure: produccion,
    sameSite: 'lax',
    path: '/',
    maxAge: 400 * 24 * 60 * 60,
  });
  return nuevo;
}
