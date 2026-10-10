# Panel del cliente — propuesta 2

Prototipo navegable en `index.html` (HTML, CSS y JS sin dependencias), con datos de ejemplo al 10 de octubre
de 2026. Mismo sistema que la landing de esta propuesta (`../landing/NOTAS.md`): el DESIGN.md de Refero con los
colores del logo e Inter. Tiene las mismas funciones que el panel de la propuesta 1, con otra forma.

## Ideas que lo distinguen

1. **El titular de cada vista es el dato más importante.**
   - En Mis cuentas, el titular dice "Una licencia vence en 5 días.", con la única píldora naranja de la
     vista: "Renovar trimestral".
   - En Pagos, el protagonista es la cuenta regresiva de la orden, a 180 px.
   - En Perfil, el titular es el nombre del cliente.
2. **El tiempo de la licencia se dibuja con triángulos**, el mismo que arma el logo en la landing.
   - Cada licencia es un calendario con una fila por mes real (con su nombre) y un triángulo por día.
   - Los días usados van en gris tenue y los que quedan en naranja.
   - Hoy es un triángulo relleno, y el mes de obsequio de la semestral va en verde limón.
   - El largo de la licencia se ve de un vistazo: 3 filas la trimestral y 6 la semestral.
   - Lo dibuja JS a partir de la fecha de inicio y los meses, con los días reales de cada mes. Los ejemplos dan
     84, 5 y 181 días restantes, igual que las cifras escritas.
3. **Las confirmaciones de la blockchain también son triángulos.** Al reportar el pago aparece una fila de 20
   (Tron), 15 (BNB Smart Chain) o 2 (Bitcoin) triángulos, y se van llenando en verde limón a medida que llegan.

## Cómo se aplicó el DESIGN.md a un panel

| Regla del DESIGN.md | En el panel |
|---|---|
| Negro puro, sin tarjetas, bordes ni divisores | Las cuentas, la orden, el historial y el perfil se separan solo con espacio. La tabla no tiene líneas |
| Una sola píldora rellena por vista | Mis cuentas: "Renovar trimestral". Pagos: "Reportar pago". Panel lateral: "Guardar e ir a pagar". Lo demás son enlaces subrayados |
| Radio de 24 px y etiquetas en píldora | Campos, botones de red, dirección y estados son píldoras rellenas con blanco al 7 %, que no es un borde. El panel lateral redondea su lado izquierdo |
| Menú en mayúsculas, el activo en blanco | Igual, más un pequeño triángulo naranja bajo la pestaña activa |
| Titulares en peso 400 con interletrado de −0.04em | Igual; la cuenta regresiva va en peso 300 para que no pese tanto a ese tamaño |

**Estados:** cada uno lleva forma y palabra en una píldora de color tenue.

| Estado | Forma | Color |
|---|---|---|
| Conectada | Triángulo relleno | Verde limón |
| Vence pronto | Triángulo relleno | Naranja |
| Por conectar | Triángulo vacío | Blanco |
| Expirada | Triángulo vacío | Gris |

## Movimiento

| Qué | Ingredientes |
|---|---|
| Panel lateral | `<dialog>` con `translateX` a 320 ms y curva de cajón; entrada con `@starting-style` |
| Confirmaciones | Cada triángulo se llena en 200 ms al llegar su confirmación |
| Botones | `scale(0.97)` al presionar |
| Aviso breve | Sube con opacidad, 260 ms |

Es una herramienta de uso diario: no hay animaciones de entrada. Con `prefers-reduced-motion` el panel lateral
aparece solo con opacidad y nada más se mueve.

## Revisado

- Sin desborde a 320, 390, 768, 1024 y 1440 px, y sin errores en consola. La tabla del historial se desplaza
  dentro de su propio contenedor.
- En celular las pestañas bajan a una barra fija inferior, que se funde con el negro sin línea.
- Al cambiar de vista, el foco va al titular.
- Selector de red como `radiogroup` con flechas del teclado.
- Errores con `aria-invalid`; el foco va al primer error.
- El foco vuelve al botón que abrió el panel lateral.
- Campos de 16 px, para que el iPhone no haga zoom.
- Áreas táctiles de 44 px o más.

## Pendiente

- Direcciones de depósito reales y precio de BTC en vivo.
- Rutas reales: `/salir`, `/perfil/...` y `/legal/...`.
