# Landing DocTraderPRO — propuesta 2

Prototipo navegable en `index.html` (HTML, CSS y JS sin dependencias). Sistema de diseño: el `DESIGN.md` de
Refero (estilo de Dala, "constellation floating on black velvet"), en `../contexto/diseno/DESIGN.md`.

## Decisiones aprobadas por el usuario

1. **Colores de la marca** en lugar del violeta del DESIGN.md. El naranja del logo es el único color de acción;
   el verde limón hace de chispa.
2. **Inter** (Google Fonts) en lugar de PP Neue Montreal, que es de pago. El texto corrido va en peso 300, no 200,
   para que se lea bien en celular.
3. **Cifras de Myfxbook más una franja de logos** en lugar de testimonios, que no existen todavía.

## Sistema

| Token | Valor | Uso |
|---|---|---|
| `--vacio` | `#000000` | Fondo de toda la página: negro puro, sin paneles |
| `--blanco` | `#FFFFFF` | Titulares y texto principal |
| `--niebla` / `--ceniza` | `#BDBDBD` / `#9A9A9A` | Texto secundario, menú y notas |
| `--llama` | `#FB9819` | Único color de acción: botones en forma de píldora |
| `--senal` | `#DDDB65` | Etiqueta del hero, "1 mes de obsequio", avisos de pendiente y foco del teclado |
| `--brasa` | `#E2531F` | Solo en las partículas del cerebro |

- **Tipografía:** titulares en peso 400 con interletrado de −0.04em, hasta 113 px. El menú y los botones van en
  14 px, peso 600 y mayúsculas.
- **Forma:** botones en píldora con radio de 24 px; sin tarjetas, bordes ni sombras.
- **Composición:** todo flota sobre negro, en dos columnas, con mucho espacio. Ancho máximo de 1280 px.

## Componente por sección

| Sección | Componente |
|---|---|
| Barra superior | Transparente: logo, tres enlaces y una píldora "Comprar licencia" (en celular, solo "Comprar") |
| Hero | Dos columnas: etiqueta, titular, texto y píldora a la izquierda; el logo hecho de partículas a la derecha |
| Problema | El titular queda fijo a la izquierda mientras pasan tres problemas a la derecha |
| Cómo funciona | Cuatro pasos en zigzag con número grande; el paso 2 enlaza a JustMarkets |
| Resultados | Tres cifras de Myfxbook (pendientes), aviso de riesgo y la franja "Con qué funciona" en texto |
| Precios | Dos columnas sin tarjetas: trimestral con enlace y semestral con la única píldora de la sección. Debajo, la prueba y los medios de pago |
| Preguntas | Titular fijo y acordeón sin cajas; una pregunta abierta a la vez |
| Cierre | Frase enorme, píldora y partículas sueltas de fondo |

## El gesto: el logo hecho de partículas

- Se muestreó `../../marca/logo-icon.png` en 2.200 puntos: 1.300 del cerebro (rojo) y 900 de las barras y la
  flecha (naranja). Se le dio más peso al cerebro porque sus trazos son finos.
- Los puntos van incrustados en el HTML. Así no hace falta leer la imagen en el navegador, lo que fallaría al
  abrir el archivo local.
- Cada punto es un triángulo con borde de 1 px, como en el DESIGN.md. El 6 % son verde limón y el 3 % blancos.
- **Movimiento:**
  - Al cargar, las partículas llegan desde fuera y se ensamblan en 1,5 s, con curva ease-out y hasta 650 ms
    de retraso entre ellas. Es el único momento orquestado de la página.
  - Después respiran: se desplazan alrededor de 1 px y giran despacio.
  - Con mouse, el puntero aparta las partículas cercanas y estas vuelven solas.
  - La animación se detiene cuando el canvas sale de la pantalla o la pestaña se oculta.
  - Con `prefers-reduced-motion` el logo aparece completo y quieto.
- Las partículas del cierre son el mismo motor, solo con partículas sueltas.

## Revisado

- Sin desborde horizontal a 320, 390, 768, 1024 y 1440 px, y sin errores en consola.
- Accesibilidad:
  - Enlace para saltar al contenido.
  - El canvas del hero tiene `role="img"` y una descripción; el del cierre está oculto para lectores de pantalla.
  - Foco visible en verde limón.
  - Áreas táctiles de 44 px o más.
  - `translate="no"` en las marcas.
  - El enlace de JustMarkets lleva `rel="sponsored"` porque es de referido.
- Contrastes sobre negro:

  | Combinación | Contraste |
  |---|---|
  | Texto blanco | 21:1 |
  | Gris niebla | 11,2:1 |
  | Gris ceniza | 7,5:1 |
  | Texto negro sobre el botón naranja | 9,6:1 |
  | Verde limón | 14,4:1 |

## Pendiente de contenido real

- **Cifras de Myfxbook:** ganancia total, caída máxima y tiempo auditado. Están como "— %" con un aviso
  en verde limón.
- **Enlace a Myfxbook:** mientras Argemiro pasa el suyo, apunta a una cuenta de referencia de terceros
  (https://www.myfxbook.com/es/members/BonusMAXI/aurum-2/12250704). Hay que cambiarlo antes de publicar.
  Myfxbook bloquea las visitas automáticas (verificación de Cloudflare), así que sus cifras no se pudieron leer.
- Textos definitivos del hero y del problema, que son propuestos.
- Rutas reales: `/registro`, `/ingresar` y `/legal/...`.
