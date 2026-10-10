# Panel del cliente — notas de diseño

Prototipo navegable en `index.html` (HTML, CSS y JS sin dependencias), con datos de ejemplo al 10 de octubre
de 2026. Usa los mismos tokens, tipografía (Archivo) y retícula de 6 columnas que la landing
(`../landing/NOTAS.md`). Se pasará a Next.js junto con la landing.

## Estructura

| Vista | Qué resuelve |
|---|---|
| **Mis cuentas** (`#cuentas`) | Una fila por cuenta de trading (una licencia por cuenta). Alerta cuando una licencia vence en 7 días o menos. Caja para pedir la prueba de USD 50 y caja de soporte (Telegram e Instagram) |
| **Pagos** (`#pagos`) | Orden de pago activa con cuenta regresiva de 1 hora, elección de red, monto exacto, dirección con botón de copiar, reporte del hash con verificación en blockchain, e historial de pagos |
| **Perfil** (`#perfil`) | Datos de registro (la cédula se muestra enmascarada), editar datos y cambiar contraseña |
| **Agregar cuenta** (panel lateral) | Titular, broker, servidor, número, contraseña operativa y de inversor, y licencia (trimestral o semestral). Al guardar lleva a Pagos con la orden creada |

### La fila de una cuenta, sobre la retícula

```
| número y broker | plan y fechas | días restantes + barra de meses (2 col.) | estado | acciones |
| capital recomendado · nivel de riesgo · nota (toda la fila)                                    |
```

En tableta y celular la retícula pasa a 2 columnas, todo se apila y las pestañas bajan a una barra fija
inferior, al alcance del pulgar.

### La barra de meses

La licencia se dibuja como **un segmento por mes**. Los meses usados quedan vacíos y los que faltan, en naranja.
El mes en curso se llena desde la derecha, porque lo que queda es su parte final. El mes de obsequio de la
semestral va en verde limón con borde punteado y la leyenda "El último mes es de regalo". La prueba y el
completar a semestral no llevan ese mes, como dicen las reglas del negocio.

### Estados

Cada estado lleva **forma y palabra**, no solo color: cuadro lleno para "Conectada", "Vence pronto" y "Aprobado";
cuadro vacío para "Por conectar", "Pendiente" y "Expirada".

## Decisiones

- **Montos cripto con punto decimal** (`319.00 USDT`, `0.00398 BTC`): es el formato que se escribe en billeteras y
  exchanges. Los montos en dólares siguen el formato colombiano (`USD 2.000`).
- **El monto en BTC se fija al crear la orden** y vale durante la hora de la orden.
- **Advertencia de red** junto a la dirección: enviar por otra red pierde el pago.
- **Las contraseñas del broker usan `autocomplete="off"`**: si fuera `new-password`, el gestor del navegador las
  guardaría como si fueran la contraseña de DocTraderPRO.
- **La verificación del hash se muestra por pasos** (transacción encontrada, dirección, monto, confirmaciones
  20 / 15 / 2 según la red). Al terminar dice que un administrador la aprobará: la aprobación automática está
  apagada por defecto.

## Movimiento (Emil Kowalski)

| Qué | Ingredientes |
|---|---|
| Panel lateral | `<dialog>` con `translateX` a 300 ms y curva de cajón; entrada con `@starting-style`; fondo con opacidad |
| Botones al presionar | `scale(0.97)` a 160 ms |
| Aviso breve (toast) | Sube 150 % con opacidad, 260 ms ease-out |
| Progreso de la verificación | `scaleX` a 400 ms ease-out |
| Pestañas y botones de red | Solo color, 200 ms |

Con `prefers-reduced-motion` el panel aparece con opacidad, sin desplazamiento, y el resto queda sin transición.

## Revisión (web-design-guidelines y pruebas)

### Corregido durante la revisión

| Hallazgo | Corrección |
|---|---|
| Pestañas apiladas y columnas de las cuentas desalineadas: `subgrid` dentro de un elemento que no era grilla | `nav` y la lista de cuentas pasan a ser grilla con `subgrid` |
| En celular las pestañas inferiores tapaban la barra superior: `backdrop-filter` crea un bloque contenedor para los elementos fijos | Sin desenfoque por debajo de 960 px; fondo casi opaco |
| Desborde horizontal en Pagos a 390 px: el texto oculto del encabezado de la tabla escapaba del contenedor con scroll | `position: relative` en el contenedor de la tabla |
| Anillo de foco visible en el título al cambiar de vista | El título recibe el foco (para lectores de pantalla) sin anillo |
| Botones de red cortados en celular | Se apilan a lo ancho por debajo de 560 px |
| Panel lateral con margen en celular y botón "Mostrar" debajo del campo | Ancho completo y botón al lado |
| Separación extra en botones con texto mixto | Texto agrupado en un solo `span` |

### Conforme

- Enlace para saltar al contenido.
- Pestañas con `aria-current`.
- Selector de red como `radiogroup` con flechas del teclado.
- Errores con `aria-invalid` y `aria-describedby`; el foco va al primer error.
- Aviso breve con `role="status"`.
- El foco vuelve al botón que abrió el panel lateral.
- Campos de 16 px (sin zoom en iPhone).
- `inputmode="numeric"` en el número de cuenta y `spellcheck="false"` en hash, servidor y broker.
- Números tabulares.
- `translate="no"` en marcas.
- Sin `transition: all`.
- Sin errores en consola.
- Sin desborde a 320, 390, 768, 1024 y 1440 px.

## Pendiente de contenido real

- Direcciones de depósito reales (las del prototipo son de ejemplo).
- Precio de BTC en vivo para calcular el monto.
- Textos legales enlazados en el pie.
