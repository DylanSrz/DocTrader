# Diseño — propuestas para Argemiro

Cada propuesta es un sistema visual completo, con prototipos navegables en HTML. Cuando Argemiro elija una (o
una mezcla), esa será la referencia para construir la web en Next.js.

| Propuesta | Concepto | Piezas | Estado |
|---|---|---|---|
| [Propuesta 1](propuesta-1/README.md) | Retícula de gráfico: estética de denmu.com, marca gigante, Archivo expandida | Landing y panel del cliente | Presentada el 2026-10-10; esperando comentarios |
| [Propuesta 2](propuesta-2/README.md) | Constelación sobre negro: DESIGN.md de Refero (Dala) con los colores del logo; el logo hecho de partículas | Landing y panel del cliente | Listas el 2026-10-10; falta presentarlas |

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

Paleta sacada del logo (válida para cualquier propuesta): fondo `#070E16` / `#0D1A26`, rojo `#9E1911`,
naranja `#FB9819`, verde limón `#DDDB65`.

## Cómo ver los prototipos

Abrir el `index.html` de cada pieza en el navegador (no necesitan servidor). Los enlaces para compartir
están en el README de cada propuesta; son privados hasta que se compartan desde el menú **Compartir**.
