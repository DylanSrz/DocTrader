import { randomInt } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

/**
 * Segundo factor con app de autenticación (TOTP de 6 dígitos cada 30 segundos, RFC 6238) y códigos de
 * recuperación. Funciones puras: lo que se guarda y cómo lo decide `AccesoService`.
 */

const EMISOR = 'DocTraderPRO';

export function nuevoSecretoTotp(): string {
  return new Secret({ size: 20 }).base32;
}

function totp(secreto: string, cuenta = '') {
  return new TOTP({
    issuer: EMISOR,
    label: cuenta,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secreto),
  });
}

/** Enlace `otpauth://` que se muestra como código QR. */
export function enlaceTotp(secreto: string, correo: string): string {
  return totp(secreto, correo).toString();
}

/**
 * Revisa un código de 6 dígitos, aceptando el periodo anterior y el siguiente (relojes desfasados). Devuelve el
 * número de periodo del código, para impedir que el mismo código se use dos veces, o `null` si no vale.
 */
export function periodoDelCodigo(
  secreto: string,
  codigo: string,
  ahora = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const generador = totp(secreto);
  const diferencia = generador.validate({ token: codigo, window: 1, timestamp: ahora });
  return diferencia === null ? null : generador.counter({ timestamp: ahora }) + diferencia;
}

/** Sin letras que se confundan (0/o, 1/l/i). */
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const CANTIDAD_CODIGOS_RECUPERACION = 10;

/** Diez códigos de recuperación como `k7m2p-x9qrt` (unos 50 bits cada uno). */
export function nuevosCodigosRecuperacion(): string[] {
  const parte = () =>
    Array.from({ length: 5 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return Array.from({ length: CANTIDAD_CODIGOS_RECUPERACION }, () => `${parte()}-${parte()}`);
}

/** Forma única de un código de recuperación como lo escriba la persona (con o sin guion, en mayúsculas). */
export function normalizarCodigoRecuperacion(codigo: string): string | null {
  const limpio = codigo.toLowerCase().replace(/[^a-z0-9]/g, '');
  return limpio.length === 10 ? `${limpio.slice(0, 5)}-${limpio.slice(5)}` : null;
}
