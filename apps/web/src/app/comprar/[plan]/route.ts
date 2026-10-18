import { CODIGO_PLAN } from '@doctrader/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { obtenerSesion, tokenDeSesion } from '@/lib/sesion';
import { recordarDestino } from '@/lib/tras-ingresar';

/**
 * "Comprar mensual" / "Comprar semestral" de la landing. La landing es estática y no sabe si hay sesión, así que la
 * decisión se toma aquí:
 * - con la sesión completa de un cliente, al panel con "Agregar cuenta" abierto y el plan elegido (cada licencia es
 *   para una cuenta de trading; las que ya tiene no se tocan);
 * - con una sesión vencida o a medias (falta el segundo factor), a ingresar, y de ahí de vuelta a la compra;
 * - sin sesión, al registro con el plan; al ingresar después (ya con la cuenta creada), vuelve a la compra.
 */
export async function GET(
  peticion: NextRequest,
  { params }: { params: Promise<{ plan: string }> },
) {
  const codigo = (await params).plan.toUpperCase();
  const plan = Object.values(CODIGO_PLAN).find((p) => p === codigo);
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, peticion.url), 303);
  if (!plan) return ir('/#precios');

  const compra = `/panel?comprar=${plan}`;
  const sesion = await obtenerSesion();
  if (sesion?.estado === 'COMPLETA') {
    return ir(sesion.usuario.rol === 'CLIENT' ? compra : '/admin');
  }
  if (sesion || (await tokenDeSesion())) {
    await recordarDestino(compra);
    return ir('/ingresar');
  }
  // Sin sesión: tras registrarse (o ingresar desde el registro) vuelve a la compra.
  await recordarDestino(compra);
  return ir(`/registro?plan=${plan.toLowerCase()}`);
}
