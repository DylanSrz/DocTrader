import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DOMINIOS_GMAIL = new Set(['gmail.com', 'googlemail.com']);

/**
 * Forma canónica de un correo, para detectar dos cuentas con el mismo buzón. Minúsculas y, en Gmail, sin puntos
 * ni lo que va después de "+" (Gmail entrega `a.b+x@gmail.com` en `ab@gmail.com`).
 */
export function correoCanonico(correo: string): string {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1 || arroba === limpio.length - 1) throw new Error(`Correo no válido: "${correo}"`);
  const usuario = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);
  if (!DOMINIOS_GMAIL.has(dominio)) return limpio;
  const sinEtiqueta = usuario.split('+')[0] ?? usuario;
  return `${sinEtiqueta.replaceAll('.', '')}@gmail.com`;
}

/**
 * Cédula sin puntos, espacios ni guiones, en mayúsculas. Acepta cédula de ciudadanía o de extranjería (solo
 * dígitos) y pasaporte (letras y dígitos). Devuelve `null` si no tiene una forma razonable.
 */
export function normalizarCedula(cedula: string): string | null {
  const limpia = cedula.replace(/[\s.-]/g, '').toUpperCase();
  return /^[0-9A-Z]{5,15}$/.test(limpia) ? limpia : null;
}

/**
 * Teléfono en formato internacional E.164 (`+573001234567`). Si no trae indicativo, se asume Colombia.
 * Devuelve `null` si el número no es válido.
 */
export function normalizarTelefono(telefono: string): string | null {
  const numero = parsePhoneNumberFromString(telefono.trim(), 'CO');
  return numero?.isValid() ? numero.number : null;
}

/** Reglas de contraseña de `docs/SEGURIDAD.md` §2: largo mínimo, sin reglas raras de composición. */
export const CONTRASENA_MINIMO = 10;
export const CONTRASENA_MAXIMO = 128;
