# Panel de administración — propuesta 1

Prototipo navegable en `index.html` (HTML, CSS y JS sin dependencias), con datos de ejemplo al 10 de octubre
de 2026. Usa el sistema de la propuesta 1 (`../landing/NOTAS.md`): retícula de 6 columnas visible, Archivo
(ancho 125 en titulares), paleta del logo y botones rectangulares con borde.

Tiene las **mismas funciones, datos y comportamiento** que el panel de administración de la propuesta 2
(`../../propuesta-2/panel-admin/NOTAS.md`). Así Argemiro compara solo el estilo. Lo que cambia es la forma.

## Cómo se aplicó el sistema de la propuesta 1

| Elemento | En esta propuesta |
|---|---|
| Composición | Cada bloque se apoya en la retícula visible: título en las columnas 1–2 y contenido en las 3–6, como en la landing. Los pendientes y el resumen de cuentas ocupan una columna cada uno. Debajo de 960 px la retícula pasa a 2 columnas |
| Titulares | El nombre de la vista en mayúsculas anchas (HOY, PAGOS, CUENTAS…). El conteo va en el texto de abajo, porque el titular que informa es propio de la propuesta 2 |
| Listas | Separadas con líneas finas, como las filas de cuentas del panel del cliente |
| Botones | Rectángulos con borde; el principal en naranja relleno |
| Estados | Recuadro con marca y palabra. Ver la tabla de abajo |
| Chequeos del pago | Los mismos cuadrados: lleno si pasó, rombo si falló, vacío si espera |
| Interruptores, filtros y radios | Rectangulares. Los filtros son un grupo segmentado, como el selector de red del panel del cliente |
| Barra superior | Fija, con desenfoque. Las pestañas se subrayan en naranja y llevan un contador naranja cuadrado. En celular se desplazan de lado |
| Panel lateral y diálogo | Fondo `--tinta` con borde, igual al panel lateral del cliente |

**Estados:**

| Estado | Marca | Color |
|---|---|---|
| Correcto | Cuadrado lleno | Verde limón |
| Alerta | Cuadrado lleno | Naranja |
| Error | Rombo | Rojo legible |
| Neutro | Cuadrado vacío | Blanco o gris |

## La gráfica de ventas

- Mismos datos que en la propuesta 2, pero con **bloques rectangulares apilados por día**, que recuerdan las
  barras del logo: un bloque por licencia vendida.
- Colores por plan: semestral `#D17A0C`, trimestral `#4A88D8` y prueba `#969430`, con la prueba en bloque vacío.
- Se validaron otra vez con el validador de dataviz, ahora sobre el fondo de esta propuesta (`#070E16`): banda
  de luminosidad, croma, separación para daltonismo (ΔE 24 entre vecinos) y contraste. Todo pasa.
- Leyenda visible, tooltip por día y "Ver como tabla". En celular muestra del 1 al 15.

## Revisado

- Sin desborde a 320, 390, 768, 1024 y 1440 px en las seis vistas, y sin errores en consola.
- Flujos probados:
  - Aprobar y rechazar pagos actualizan todos los contadores.
  - Filtros y búsqueda combinados.
  - Exportar CSV con el filtro activo.
  - Ficha con retorno del foco.
  - "Ver como" socio muestra el formulario de comisión.
- Con `prefers-reduced-motion` el panel lateral y el diálogo solo cambian de opacidad.
