import 'server-only';
import { cookies } from 'next/headers';

const COOKIE = 'tras-ingresar';
const produccion = process.env.NODE_ENV === 'production';

/**
 * A dónde volver después de ingresar (por ejemplo, a la compra que se empezó con la sesión vencida). Solo rutas
 * propias del panel del cliente: nada que venga de afuera ni otro dominio.
 */
export function destinoSeguro(ruta: string | undefined | null): string | null {
  if (!ruta || !/^\/panel(\/[a-z-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(ruta)) return null;
  return ruta;
}

export async function recordarDestino(ruta: string): Promise<void> {
  const seguro = destinoSeguro(ruta);
  if (!seguro) return;
  (await cookies()).set(COOKIE, seguro, {
    httpOnly: true,
    secure: produccion,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60,
  });
}

/** El destino guardado, una sola vez: se borra al leerlo. */
export async function tomarDestino(): Promise<string | null> {
  const almacen = await cookies();
  const valor = destinoSeguro(almacen.get(COOKIE)?.value);
  if (almacen.has(COOKIE)) almacen.delete(COOKIE);
  return valor;
}
