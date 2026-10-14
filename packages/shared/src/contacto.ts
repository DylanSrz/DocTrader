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
