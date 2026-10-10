# Propuesta 1 — Retícula de gráfico

> Presentada a Argemiro el 2026-10-10. Estado: **esperando comentarios**.

## Concepto

Toma la estética de [denmu.com](https://denmu.com/), la página de referencia de Argemiro. La retícula de 6 columnas
con líneas finas se ve en toda la página y se lee como la cuadrícula de un gráfico de trading.

Los rasgos propios de la marca:
- El símbolo del logo (barras y flecha que sube) se dibuja a escala de página.
- Los relojes del pie muestran las sesiones del mercado.
- En el panel, cada licencia se dibuja como una barra dividida en meses.

- **Paleta:** la del logo (ver `../README.md`). Fondo casi negro, naranja para las acciones principales y verde limón
  para los estados positivos y el mes de regalo.
- **Tipografía:** una sola familia, Archivo (Google Fonts). Los títulos van expandidos (ancho 125), en negrita y
  mayúsculas; el texto corrido va en ancho normal.
- **Forma:** botones rectangulares con borde, sin esquinas redondeadas, sin sombras ni glassmorphism.
- **Movimiento:** una entrada animada en la landing; el panel casi no se mueve, porque es una herramienta de uso diario.

## Piezas

| Pieza | Prototipo | Enlace para compartir | Notas |
|---|---|---|---|
| Landing | [`landing/index.html`](landing/index.html) | https://claude.ai/artifact/2AryVBb5qp9WEVEeKNZszr | [`landing/NOTAS.md`](landing/NOTAS.md) |
| Panel del cliente | [`panel-cliente/index.html`](panel-cliente/index.html) | https://claude.ai/artifact/Hd9RvTX7jN7Xc5xMotnAr9 | [`panel-cliente/NOTAS.md`](panel-cliente/NOTAS.md) |

**Landing:**
- Marca gigante.
- Cómo funciona, en 4 pasos.
- Resultados, con un espacio reservado para el widget de Myfxbook.
- Licencias trimestral y semestral.
- Broker sugerido: JustMarkets.
- Preguntas frecuentes.
- Pie con sesiones del mercado, Telegram e Instagram.

**Panel del cliente:**
- Mis cuentas: una licencia por cuenta, alerta de vencimiento, solicitud de prueba y soporte.
- Pagos: orden de 1 hora, red, dirección y reporte del hash con verificación en blockchain, más el historial.
- Perfil.
- Panel lateral para agregar una cuenta de trading.

Las dos piezas se probaron a 320, 390, 768, 1024 y 1440 px, con movimiento reducido y con la auditoría
web-design-guidelines de Vercel (detalle en cada `NOTAS.md`).

## Qué no incluye todavía

- Panel de administración: ventas, aprobación de pagos, listas "por conectar" y "por desconectar", y comisión del socio.
- Pantallas de registro e ingreso.
- Contenido real: textos, preguntas frecuentes, widget de Myfxbook y documentos legales (ver `docs/PENDIENTES.md`).

## Comentarios de Argemiro

_Pendientes._
