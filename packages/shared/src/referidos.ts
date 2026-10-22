/**
 * Programa de referidos (`docs/PLAN-TRABAJO.md`, etapa 11): quien refiere gana un porcentaje de cada licencia que paga
 * su referido, liquidado por quincenas (las mismas del socio, `comision.ts`) y pagado en USDT (Tron).
 * Refieren los clientes con licencia activa (o en gracia), las personas que un admin habilite y el socio.
 */

/** Valores iniciales de los ajustes del programa (tabla `settings`); se cambian desde el panel. */
export const REFERIDOS_INICIAL = {
  /** 20 %, en puntos básicos. */
  porcentajeBp: 2_000,
  /** Mínimo para enviar un pago: USD 20. Lo que no llega se suma a la quincena siguiente. */
  minimoPagoUsdCents: 2_000,
  activo: true,
} as const;

/** Límites del porcentaje editable: hasta 50 %, como el del socio. */
export const LIMITES_REFERIDOS = {
  minimoBp: 0,
  maximoBp: 5_000,
  minimoPagoMaxUsdCents: 100_000,
} as const;

/** Tras cambiar la dirección de cobro, las quincenas que se cierren en estas horas quedan en espera. */
export const ESPERA_CAMBIO_DIRECCION_HORAS = 48;

/** Días que dura la cookie del enlace de referido: si se registra en ese tiempo, cuenta. Gana el último enlace. */
export const DIAS_COOKIE_REFERIDO = 30;

/** Alfabeto del código: sin 0, O, 1, I ni L, que se confunden al dictarlo o copiarlo a mano. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 8;

/** Un código nuevo a partir de bytes aleatorios (los pone quien llama: `crypto.randomBytes` o `getRandomValues`). */
export function codigoDesdeBytes(bytes: Uint8Array): string {
  if (bytes.length < LARGO_CODIGO) throw new Error(`Hacen falta ${LARGO_CODIGO} bytes`);
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO; i++)
    codigo += ALFABETO_CODIGO[bytes[i]! % ALFABETO_CODIGO.length];
  return codigo;
}

/** El código tal como se escribe: mayúsculas y sin espacios ni guiones. `null` si no tiene la forma de un código. */
export function normalizarCodigo(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto.trim().toUpperCase().replace(/[\s-]/g, '');
  if (limpio.length !== LARGO_CODIGO) return null;
  for (const letra of limpio) if (!ALFABETO_CODIGO.includes(letra)) return null;
  return limpio;
}

/**
 * Forma de una dirección de Tron (base58, empieza por T, 34 caracteres). La API además comprueba la suma de control.
 */
export function formaDireccionTron(texto: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(texto.trim());
}

/** "Patricia O.": lo único que ve quien refiere de sus referidos (nombre de pila e inicial del apellido). */
export function nombreReservado(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  const [primero, segundo] = partes;
  if (!primero) return 'Cliente';
  return segundo ? `${primero} ${segundo[0]!.toUpperCase()}.` : primero;
}
