# Diseño — propuestas para Argemiro

Cada propuesta es un sistema visual completo, con prototipos navegables en HTML. Cuando Argemiro elija una (o
una mezcla), esa será la referencia para construir la web en Next.js.

| Propuesta | Concepto | Piezas | Estado |
|---|---|---|---|
| [Propuesta 1](propuesta-1/README.md) | Retícula de gráfico: estética de denmu.com, marca gigante, Archivo expandida | Landing y panel del cliente | Presentada el 2026-10-10; esperando comentarios |
| [Propuesta 2](propuesta-2/README.md) | Constelación sobre negro: DESIGN.md de Refero (Dala) con los colores del logo; el logo hecho de partículas | Landing, panel del cliente y panel de administración | Presentada el 2026-10-10; esperando comentarios |

## Cómo se diferencian

| | Propuesta 1 | Propuesta 2 |
|---|---|---|
| Referencia | denmu.com | DESIGN.md de Refero (Dala) y Xapo Bank |
| Fondo | Azul casi negro del logo (`#070E16`), con la retícula de 6 columnas a la vista | Negro puro, sin líneas ni tarjetas |
| Tipografía | Archivo expandida, en negrita y mayúsculas | Inter en peso normal, titulares enormes en minúsculas |
| Botones | Rectángulos con borde | Píldoras; un solo botón naranja por vista |
| Gesto de marca | Las barras y la flecha del logo a escala de página | El logo hecho de partículas triangulares |
| Licencia en el panel | Barra dividida en meses | Calendario de triángulos, uno por día |
| Panel de administración | No incluido | Incluido |
| Sensación | Técnica, de gráfico de trading | Silenciosa y premium, de banca privada |

## Estructura

```
design/
├── marca/          logo de Argemiro y sus derivados; los usan todas las propuestas
└── propuesta-N/
    ├── README.md   concepto, piezas, enlaces para compartir y comentarios recibidos
    ├── contexto/   material de referencia (capturas, DESIGN.md, componentes, logo, íconos), si lo hay
    └── <pieza>/    index.html (prototipo) + NOTAS.md (decisiones, movimiento y auditoría)
```

## Marca compartida (`marca/`)

| Archivo | Uso |
|---|---|
| `logo-original.png` | Logo tal como lo entregó Argemiro |
| `logo-icon.png` | Solo el ícono (cerebro con barras), fondo transparente |
| `logo-icon-64.png` | Ícono a 54×64 px para barras de navegación |
| `favicon.png` | Ícono de la pestaña del navegador |

Colores del logo, comunes a las propuestas: rojo `#9E1911`, naranja `#FB9819` y verde limón `#DDDB65`.
El fondo lo decide cada propuesta: azul casi negro del logo (`#070E16` / `#0D1A26`) en la 1 y negro puro en la 2.

## Cómo ver los prototipos

Abrir el `index.html` de cada pieza en el navegador (no necesitan servidor). Los enlaces para compartir
están en el README de cada propuesta; son privados hasta que se compartan desde el menú **Compartir**.
