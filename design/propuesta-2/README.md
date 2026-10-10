# Propuesta 2 — Constelación sobre negro

> Presentada a Argemiro el 2026-10-10. Estado: **esperando comentarios**.

## Concepto

Usa el sistema de diseño exportado de Refero ([`contexto/diseno/DESIGN.md`](contexto/diseno/DESIGN.md), estilo de
Dala, "constellation floating on black velvet"), adaptado a la marca de Argemiro. Todo flota sobre negro puro, sin
tarjetas ni bordes, y la jerarquía la dan el tamaño del texto y el espacio.

El rasgo propio es el triángulo, la misma unidad en todas las piezas:
- En la landing, el logo (cerebro, barras y flecha) se arma con 2.200 partículas triangulares al cargar la página.
- En el panel del cliente, cada licencia es un calendario con un triángulo por día.
- En el panel de administración, las ventas del mes se cuentan con un triángulo por licencia.
- Los chequeos de la blockchain también son triángulos que se llenan.

- **Paleta:** negro puro `#000`, blanco y grises. El naranja del logo (`#FB9819`) es el único color de acción y el
  verde limón (`#DDDB65`) hace de chispa. El violeta del DESIGN.md se cambió por los colores de la marca, por
  decisión del usuario.
- **Tipografía:** Inter (Google Fonts), sustituto de PP Neue Montreal que indica el propio DESIGN.md. Los titulares
  van en peso 400 con interletrado cerrado, hasta 113 px; el texto corrido en peso 300.
- **Forma:** botones y campos en píldora con radio de 24 px, un solo botón relleno por vista, y enlaces subrayados
  para lo demás.
- **Titulares que informan:** en los paneles, el titular de cada vista es el dato más importante. Por ejemplo,
  "Una licencia vence en 5 días." o "Hoy tienes 8 pendientes.".
- **Movimiento:** un solo momento orquestado, el logo que se ensambla en la landing. Los paneles casi no se mueven.

## Piezas

| Pieza | Prototipo | Enlace para compartir | Notas |
|---|---|---|---|
| Landing | [`landing/index.html`](landing/index.html) | https://claude.ai/artifact/RX6NGDrxrvHL28XM7UszqE | [`landing/NOTAS.md`](landing/NOTAS.md) |
| Panel del cliente | [`panel-cliente/index.html`](panel-cliente/index.html) | https://claude.ai/artifact/YGziRJuprX4GhHikkn8fx7 | [`panel-cliente/NOTAS.md`](panel-cliente/NOTAS.md) |
| Panel de administración | [`panel-admin/index.html`](panel-admin/index.html) | https://claude.ai/artifact/U7886432GshaU1wJ5JyZ4i | [`panel-admin/NOTAS.md`](panel-admin/NOTAS.md) |

**Landing:**
- Hero con el logo de partículas.
- Problema.
- Cómo funciona, en 4 pasos.
- Resultados de Myfxbook y la franja "Con qué funciona".
- Precios.
- Preguntas frecuentes.
- Cierre.

Los componentes de cada sección están en [`contexto/diseno/componentes.md`](contexto/diseno/componentes.md).

**Panel del cliente:**
- Mis cuentas: calendario de triángulos por licencia, estados, prueba y soporte.
- Pagos: orden de 1 hora con cuenta regresiva grande, red, dirección, y reporte del hash con las confirmaciones
  dibujadas como triángulos. Incluye el historial.
- Perfil.
- Panel lateral para agregar una cuenta.

**Panel de administración:**
- Hoy: pendientes, ventas del mes y actividad.
- Pagos: chequeos de la blockchain, rechazo con motivo, aprobación automática y pruebas.
- Cuentas: por conectar y por desconectar.
- Licencias: filtros, búsqueda, CSV y ficha del cliente.
- Ajustes.
- Socio: comisión y liquidaciones.

Las tres piezas se probaron a 320, 390, 768, 1024 y 1440 px y con movimiento reducido (detalle en cada `NOTAS.md`).

## Qué no incluye todavía

- Pantallas de registro e ingreso.
- Editor de preguntas frecuentes y vista completa de la auditoría.
- **Contenido real:**
  - Cifras y enlace de la cuenta de Myfxbook de Argemiro. Hoy la landing enlaza una cuenta de referencia de
    terceros, que hay que cambiar antes de mostrarla al público.
  - Textos definitivos, documentos legales y direcciones de depósito (ver `docs/PENDIENTES.md`).

## Contexto de diseño (`contexto/diseno/`)

| Archivo | Qué es | Estado |
|---|---|---|
| `DESIGN.md` | Sistema de diseño de Refero: estilo de Dala | Usado como base, con los colores de la marca e Inter |
| `referencia-1.png` | Captura completa de Xapo Bank (https://www.xapobank.com/en), tomada el 2026-10-10 | Recibida |
| `componentes.md` | Componente aprobado para cada sección de la landing | Completo |
| `referencia-2.png` | Segunda página de referencia | No se entregó |
| `cta-1.png` | Llamado a la acción de referencia | No se entregó |
| `logo.svg` | Logo en vector | Pendiente: solo hay PNG en `../marca/`. Las partículas se sacaron del PNG |
| `iconos/` | Íconos 3D de 3dicons | No se usaron: el estilo pide imágenes abstractas, sin ilustraciones |

## Comentarios de Argemiro

_Pendientes._
