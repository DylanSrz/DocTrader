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

/**
 * La política de contraseñas como lista de requisitos, para mostrarla mientras se escribe. Son los mismos que exige
 * la API (largo mínimo y máximo); que no esté filtrada solo se puede revisar al enviar.
 */
export function requisitosContrasena(contrasena: string): { texto: string; cumple: boolean }[] {
  const largo = contrasena.length;
  return [
    { texto: `Al menos ${CONTRASENA_MINIMO} caracteres`, cumple: largo >= CONTRASENA_MINIMO },
    {
      texto: `Como máximo ${CONTRASENA_MAXIMO} caracteres`,
      cumple: largo > 0 && largo <= CONTRASENA_MAXIMO,
    },
  ];
}

/** Un teléfono guardado (`+573001234567`) como se lee: "+57 300 1234567". */
export function formatearTelefono(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
