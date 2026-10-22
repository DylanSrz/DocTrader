/**
 * Marcas de la franja "Con qué funciona" de la landing, en el orden en que pasan.
 *
 * Para agregar o cambiar un logo:
 * 1. Guarda el archivo oficial en `apps/web/public/logos/` (SVG de preferencia; si es PNG, con fondo transparente y
 *    al menos el doble del alto con que se ve, unos 96 px).
 * 2. Pon su ruta en `archivo` (por ejemplo `/logos/myfxbook.svg`) y su tamaño original en `ancho` y `alto`
 *    (en píxeles o en las unidades del viewBox del SVG): con eso se respeta la proporción y no se mueve el diseño.
 * Mientras una marca no tenga `archivo`, la franja muestra su nombre escrito.
 */
export interface LogoCompatible {
  nombre: string;
  archivo?: string;
  ancho?: number;
  alto?: number;
}

export const LOGOS_COMPATIBLES: readonly LogoCompatible[] = [
  { nombre: 'Myfxbook' },
  { nombre: 'Social Trader Tools' },
  { nombre: 'JustMarkets' },
  { nombre: 'Tron' },
  { nombre: 'Bitcoin' },
];
