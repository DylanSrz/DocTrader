/**
 * Marcas de la franja "Con qué funciona" de la landing, en el orden en que pasan.
 *
 * Los archivos están en `apps/web/public/logos/` y salen de Brandfetch (logos oficiales), en su versión para fondo
 * oscuro: donde la marca traía el texto oscuro (Bitcoin, MetaTrader 4, TradingView) se usó el mismo logo con el texto
 * en blanco. Ver `design/marca/README.md`.
 *
 * Para agregar o cambiar un logo:
 * 1. Guarda el archivo oficial en `apps/web/public/logos/` (SVG de preferencia; si es PNG, con fondo transparente,
 *    pensado para fondo oscuro y de al menos 80 px de alto).
 * 2. Agrégalo aquí con su ruta en `archivo` y su tamaño original en `ancho` y `alto` (en píxeles o en las unidades
 *    del viewBox del SVG): con eso se respeta la proporción, se ajusta el tamaño y no se mueve el diseño.
 * 3. Si la marca solo tiene símbolo (sin el nombre escrito), pon el nombre en `etiqueta` y se muestra al lado.
 * Una marca sin `archivo` muestra su nombre escrito.
 */
export interface LogoCompatible {
  nombre: string;
  archivo?: string;
  ancho?: number;
  alto?: number;
  /** Texto junto al símbolo, para marcas cuyo logo no trae el nombre. */
  etiqueta?: string;
}

export const LOGOS_COMPATIBLES: readonly LogoCompatible[] = [
  { nombre: 'Myfxbook', archivo: '/logos/myfxbook.png', ancho: 143, alto: 38 },
  { nombre: 'MetaTrader 4', archivo: '/logos/metatrader-4.png', ancho: 175, alto: 47 },
  {
    nombre: 'Social Trader Tools',
    archivo: '/logos/social-trader-tools.png',
    ancho: 222,
    alto: 108,
  },
  { nombre: 'JustMarkets', archivo: '/logos/justmarkets.svg', ancho: 182, alto: 26 },
  { nombre: 'TradingView', archivo: '/logos/tradingview.svg', ancho: 185, alto: 26 },
  { nombre: 'USDT', archivo: '/logos/usdt.svg', ancho: 54, alto: 44, etiqueta: 'USDT' },
  { nombre: 'TRON', archivo: '/logos/tron.png', ancho: 180, alto: 180, etiqueta: 'TRON' },
  { nombre: 'Bitcoin', archivo: '/logos/bitcoin.svg', ancho: 421, alto: 88 },
];
