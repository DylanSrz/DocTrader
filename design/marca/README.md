# Marca

| Archivo | Qué es | Para qué |
|---|---|---|
| `logo-original.png` | El logo que entregó la marca (990 × 897, fondo azul oscuro) | Fuente; no editar |
| `logo-doctraderpro.png` | Logo completo con fondo **transparente** (759 × 499), sacado del original | Fondos oscuros: documentos, presentaciones, redes |
| `logo-doctraderpro-1080.png` | Logo completo sobre negro, cuadrado de 1080 × 1080 | Foto de perfil, publicaciones |
| `logo-icon.png` | Solo el ícono (cerebro con barras), transparente | La web lo usa en la barra (`apps/web/public/marca/`) |
| `favicon.png`, `logo-icon-64.png` | Ícono pequeño | Pestaña del navegador |

- El logo transparente está pensado para **fondos oscuros**: el original traía una sombra oscura alrededor de las letras
  que sobre blanco se nota. Para fondos claros, o para imprimir en grande, conviene pedir el logo en vector (SVG o AI)
  a quien lo diseñó.
- En la web: `apps/web/src/app/opengraph-image.png` y `twitter-image.png` (vista previa al compartir el enlace,
  1200 × 630), `apple-icon.png` (ícono en iPhone), `public/marca/icono-192.png` e `icono-512.png` (manifiesto) y
  `public/marca/logo-doctraderpro-512.png` (logo para Google en los datos estructurados).
- Cada texto legal tiene su propia imagen para compartir: `apps/web/public/compartir/legal-<ruta>.png` (terminos, datos,
  riesgo), con el mismo diseño y el título del documento.

## Logos de otras marcas (franja "Con qué funciona")

Están en `apps/web/public/logos/` y salen de **Brandfetch** (logos oficiales de cada marca): Myfxbook, MetaTrader 4,
Social Trader Tools, JustMarkets, TradingView, USDT (símbolo de Tether), TRON y Bitcoin. Se usa la versión para fondo
oscuro; en Bitcoin, MetaTrader 4 y TradingView el texto venía oscuro y se pasó a blanco (sin tocar los colores de marca).
Myfxbook y MetaTrader 4 solo están en Brandfetch en tamaño pequeño (38 y 47 px de alto): si se consigue su SVG, basta
con reemplazar el archivo y su tamaño en `apps/web/src/components/landing/logos-compatibles.ts`.

