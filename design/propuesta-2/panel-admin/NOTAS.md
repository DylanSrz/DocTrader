# Panel de administración — propuesta 2

Prototipo navegable en `index.html` (HTML, CSS y JS sin dependencias), con datos de ejemplo al 10 de octubre
de 2026. Lo usan Argemiro y el socio desarrollador, ambos con todos los permisos. Usa el mismo sistema que la
landing y el panel del cliente de esta propuesta.

## Vistas

| Vista | Titular | Qué resuelve |
|---|---|---|
| **Hoy** | "Hoy tienes 8 pendientes." | Los cuatro montones de trabajo, ventas del mes, resumen de cuentas y actividad reciente |
| **Pagos** | "3 pagos por revisar." | Aprobar o rechazar pagos, solicitudes de prueba y órdenes expiradas |
| **Cuentas** | "2 cuentas por conectar en Social Trader Tools." | Lista por conectar y lista por desconectar |
| **Licencias** | "47 licencias activas. 3 vencen esta semana." | Filtros, búsqueda, exportar a CSV y ficha del cliente |
| **Ajustes** | "Ajustes" | Precios, días de gracia, vigencia de la orden, mes de obsequio, confirmaciones, aprobación automática, direcciones de depósito y enlaces |
| **Socio** | "USD 368,20 de comisión para el 15 de octubre." | Porcentaje de comisión, liquidaciones del 15 y el 30, e historial de cambios |

Como en el panel del cliente, el titular de cada vista dice cuánto trabajo hay. Los contadores se actualizan al
aprobar, rechazar, conectar o desconectar: los del titular, los de Hoy y los de las pestañas.

### Detalles de cada vista

- **Pagos:**
  - Cada pago muestra lo que debía llegar y lo que llegó, el hash con enlace al explorador, y los cinco
    chequeos de la verificación en la blockchain.
  - Un triángulo verde limón es un chequeo que pasó, uno rojo invertido uno que falló, y uno vacío algo en espera.
  - Solo el pago verificado lleva la píldora naranja "Aprobar pago". El de monto incompleto sugiere pedir lo
    que falta. El que espera confirmaciones no se puede aprobar todavía.
  - Rechazar abre un diálogo con el motivo, que le llega al cliente por correo.
- **Aprobación automática:** el interruptor de Pagos y el de Ajustes son el mismo, y está apagado por defecto.
- **Pruebas:** la plataforma cruza la cédula con las pruebas anteriores y lo dice antes de aprobar.
- **Cuentas por conectar:**
  - Cada cuenta trae los datos que Argemiro necesita en Social Trader Tools, con botón de copiar.
  - Las contraseñas están ocultas. "Ver contraseñas" las muestra y deja el registro en la auditoría.
  - Ahí mismo se fijan el capital recomendado y el nivel de riesgo, que luego ve el cliente.
- **Ficha del cliente** (panel lateral desde Licencias):
  - Contacto, con la cédula completa solo bajo acción explícita, que queda en la auditoría.
  - Capital y riesgo, extender días, notas internas.
  - Suspender, con un segundo clic de confirmación.
- **Ver como:** en la franja del prototipo se cambia entre Argemiro y el socio. Solo el socio ve el formulario
  para cambiar su porcentaje.
  - El cambio aplica a ventas posteriores, por eso la comisión del periodo no se recalcula.
  - Argemiro recibe un aviso y el cambio queda en la auditoría.

## La gráfica de ventas (skill dataviz)

- **Forma:** un pictograma con un triángulo por licencia vendida, apilados por día. Con 9 ventas en el mes,
  un triángulo por venta se lee mejor que una barra, y repite la unidad de toda la propuesta.
- **Color por plan:** semestral `#D17A0C`, trimestral `#4A88D8` y prueba `#969430`.
  - Pasó el validador de la skill sobre negro: banda de luminosidad, croma, separación para daltonismo (ΔE 24
    entre vecinos) y contraste.
  - El naranja y el verde limón del logo no entraban en la banda de luminosidad para fondo oscuro, por eso
    se usan versiones más oscuras.
  - Comparando todos los pares, semestral y prueba se parecen para deuteranopía. Por eso la prueba es un
    **triángulo vacío**: se distingue por la forma y no solo por el color.
- **Lectura:**
  - Leyenda siempre visible y tooltip por día al pasar el mouse.
  - "Ver como tabla" muestra los mismos datos en una tabla, para lectores de pantalla y pantallas táctiles.
  - En celular la gráfica muestra solo del 1 al 15 para que los triángulos no se encojan.
- El texto nunca va en el color de la serie.

## Movimiento

| Qué | Ingredientes |
|---|---|
| Ficha (panel lateral) | `translateX` a 320 ms con curva de cajón |
| Diálogo de rechazo | `scale(0.97)` más opacidad a 200 ms |
| Al aprobar o marcar algo | El elemento se desvanece y sube 6 px en 220 ms; el foco pasa al siguiente |
| Interruptores y radios | 200 a 220 ms ease-out |

Con `prefers-reduced-motion` solo quedan cambios de opacidad.

## Revisado

- Sin desborde a 320, 390, 768, 1024 y 1440 px en las seis vistas, y sin errores en consola.
- En celular la barra superior queda fija y las pestañas se desplazan de lado.
- Flujos probados:
  - Aprobar y rechazar actualizan todos los contadores.
  - Los filtros y la búsqueda se combinan.
  - El CSV respeta el filtro. Publicado como Artifact usa la capacidad `downloads` (el visor pide confirmación); abierto en local, un enlace de descarga normal.
  - El foco vuelve al botón que abrió la ficha.
- El texto de las pestañas lleva un contador naranja que desaparece en cero.

## Fuera de este prototipo

- Editor de preguntas frecuentes (queda el enlace).
- Vista completa de auditoría (hay "Exportar auditoría" y la actividad reciente).
- Correos y alertas, que se definen en `docs/CONTEXTO.md`.
- Binance Pay, que se agrega cuando Binance apruebe la cuenta de comerciante.
