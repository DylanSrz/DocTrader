# Landing DocTraderPRO — notas de diseño

Prototipo navegable en `index.html` (HTML y CSS sin dependencias). Se pasará a Next.js con Tailwind cuando
empiece el desarrollo. Referencia visual: [denmu.com](https://denmu.com/).

## Plan de diseño (frontend-design)

**Qué se tomó de la referencia:**
- Fondo casi negro.
- Retícula de 6 columnas con líneas finas visibles en toda la página.
- La marca gigante que ocupa todo el ancho arriba.
- Frases grandes en mayúsculas.
- Botones rectangulares con borde.
- Bloques escalonados sobre la retícula.
- El rodillo de texto al pasar el mouse por el menú.
- Los relojes del pie de página.

**Qué es propio de DocTraderPRO:**
- La retícula se lee como la cuadrícula de un gráfico.
- El único gesto fuerte de la página es el símbolo del logo (barras y flecha que sube), dibujado a escala de
  página donde la referencia pone sus letras 3D.
- Los relojes del pie son las **sesiones del mercado** (Sídney, Tokio, Londres, Nueva York), abiertas o cerradas.

### Paleta (sacada del logo)

| Token | Hex | Origen y uso |
|---|---|---|
| `--abismo` | `#070E16` | Esquinas del fondo del logo. Fondo de la página |
| `--tinta` | `#0D1A26` | Centro del fondo del logo. Superficies elevadas |
| `--brasa` | `#9E1911` | Rojo de "Doc" y "PRO". Inicio del degradado |
| `--llama` | `#FB9819` | Naranja de "Trader" y de las barras. Botón principal y acentos |
| `--senal` | `#DDDB65` | Verde limón de "IA System". Foco del teclado, estados y "mes de regalo" |
| `--hueso` / `--niebla` | `#EEF1F4` / `#95A3B3` | Texto principal y secundario |

**Contrastes, todos AA y la mayoría AAA:**

| Combinación | Contraste |
|---|---|
| Texto principal sobre fondo | 17,1:1 |
| Texto secundario sobre fondo | 7,5:1 |
| Texto del botón principal | 8,9:1 |
| Verde limón sobre fondo | 13,3:1 |

### Tipografía

Una sola familia: **Archivo**, de Google Fonts, aprovechando su eje de ancho.
- **Ancho 125 (expandida), en negrita:** la marca gigante, las frases del héroe, los títulos y los precios.
  Es lo más cercano a la Helvetica Now Display de la referencia y a las letras anchas del logo.
- **Ancho 100 (normal):** el texto corrido.
- Las cifras usan números tabulares.

Se descartaron las sugerencias de ui-ux-pro-max (Space Grotesk con Inter, y modo oscuro con glassmorphism)
por genéricas para un producto cripto.

### Composición

```
| DocTraderPRO ─────────────────────────── (ancho exacto de la retícula) |
| ícono IA System | Cómo funciona | Resultados | Licencias | Preguntas | Ingresar  Comprar |
|   barras + flecha del logo, sobre las 6 columnas                      |
|──────────────────────────── línea base ───────────────────────────────|
| FRASE DEL HÉROE (columnas 1–4)          | texto, botones, Myfxbook (5–6) |
| TÍTULO (1–2) | pasos 1→4 escalonados en diagonal (3–6)               |
| TÍTULO (1–2) | visor de Myfxbook (3–5)       | texto (6)              |
| TÍTULO (1–2) | trimestral (3–4, más abajo) | semestral (5–6, destacada) |
| ¿NO SABES QUÉ BROKER ELEGIR? (1–4)           | JustMarkets (5–6)    |
| TÍTULO (1–2) | preguntas en acordeón (3–6)                            |
| sesiones del mercado | soporte por Telegram | enlaces legales         |
```

Todo va alineado a la izquierda dentro de su columna. En pantallas de menos de 960 px la retícula pasa a
2 columnas y todo se apila. El menú compacto aparece por debajo de 1180 px.

## Movimiento (skill `animate`, de Emil Kowalski)

| Qué | Por qué | Ingredientes |
|---|---|---|
| Entrada del héroe: la marca se revela, las barras crecen en cascada, la línea se dibuja y aparece la punta de la flecha | Primera visita: es el único momento "deleite" de la página | `clip-path` a 700 ms con ease-in-out fuerte; barras con `scaleY` de 0,02 a 1 en 520 ms, ease-out y 55 ms entre cada una; trazo con `stroke-dashoffset` a 1100 ms. Arranca cuando cargan las fuentes |
| Títulos de sección | Revelado de marketing, una sola vez | `clip-path` a 600 ms con `IntersectionObserver` |
| Menú: rodillo de texto | Respuesta al mouse | `transform` a 240 ms ease-out, solo con mouse (`hover: hover`) |
| Botones al presionar | Confirmar el toque | `scale(0.97)` a 160 ms |
| Acordeón de preguntas | Que el contenido no salte | `::details-content` con altura y opacidad a 200 ms; la cruz gira 45° |
| Menú del celular | Mostrar de dónde sale | `scale(0.97)` más opacidad, 200 ms, desde la esquina del botón |

Con `prefers-reduced-motion` todo aparece en su estado final y solo quedan transiciones de opacidad.

## Auditoría (web-design-guidelines de Vercel)

Reglas descargadas de `vercel-labs/web-interface-guidelines` el 2026-10-10.

### Corregido

| Ubicación | Hallazgo | Corrección |
|---|---|---|
| `index.html:431` | El botón del menú tenía `aria-label="Abrir menú"`, distinto del texto visible "Menú" | Se quitó; queda el texto visible |
| `index.html:418` | Ícono de 144 KB para mostrarse a 30 px, sin prioridad de carga | Versión de 54×64 px (11 KB) con `fetchpriority="high"` |
| `index.html:139` | El tamaño de la marca se calculaba midiendo con JS | Unidades de contenedor (`11.18cqi`) en CSS puro |
| `index.html:42`, `:297` | Faltaban las zonas seguras (notch) | `env(safe-area-inset-*)` en márgenes y pie |
| `index.html:67` | Faltaba `touch-action: manipulation` en enlaces | Aplicado a `a`, `summary` y `button` |
| `index.html:68` | Rebote de la página con mouse | `overscroll-behavior: none` solo con puntero fino |
| Marcas en el texto | Faltaba `translate="no"` en DocTraderPRO, Myfxbook, JustMarkets e IA System | Agregado |
| Cantidades | Faltaban espacios de no separación en "USD 106", "3 meses", "1 hora", etc. | `&nbsp;` |
| Enlaces de prueba | Anclas `#ingresar`, `#terminos`, etc. que no existían | Rutas previstas (`/ingresar`, `/legal/...`); Telegram y Myfxbook marcados con `data-pendiente` |
| `index.html:540`, `:584` | Separación de más dentro de botones con texto mixto | Texto agrupado en un solo `span` |
| Logo del menú | Le faltaba estado al pasar el mouse | Giro leve del ícono |

### Revisado y conforme

- Enlace para saltar al contenido.
- Títulos en orden: un `h1`, luego `h2`, luego `h3`.
- Foco visible con `:focus-visible` en verde limón.
- Sin `transition: all`; solo se animan `transform`, `opacity` y `clip-path`.
- `prefers-reduced-motion` respetado.
- `color-scheme: dark` y `theme-color` igual al fondo.
- Imágenes con ancho y alto.
- Horas con `Intl.DateTimeFormat`.
- Números tabulares en precios y relojes.
- `text-wrap: balance` en los títulos.
- Sin desborde horizontal a 320, 390, 768, 1024 y 1440 px.
- Sin errores en consola.

### No aplicado, a propósito

| Regla | Motivo |
|---|---|
| Mayúscula inicial en cada palabra de títulos y botones (estilo Chicago) | Es una convención del inglés; en español se escribe en minúscula salvo la primera palabra |
| Evitar la primera persona | "Yo uso JustMarkets" es la voz de Argemiro, pedida por el cliente |
| Precargar la fuente | Google Fonts sirve la fuente con URL cambiante; ya hay `preconnect` y `display=swap`. Al pasar a Next.js se resuelve con `next/font` |
| `aria-live` en los relojes | Anunciaría la hora cada 30 segundos; sería ruido para lectores de pantalla |

## Pendiente de contenido real

- Código del widget de Myfxbook y enlace a la cuenta auditada.
- Textos legales: términos, tratamiento de datos y aviso de riesgo.
