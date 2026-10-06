# Contexto del proyecto — Plataforma Doc Trader Pro AI

> Última actualización: 2026-10-06
> Estado: **Planeación** (aún no hay código)

## 1. Resumen

Plataforma web para vender **licencias de uso del software Doc Trader Pro AI**, propiedad de Argemiro.
El software replica la operativa de la cuenta de Argemiro en las cuentas de trading de los clientes
(copy trading), en el broker que cada cliente elija.

**Posicionamiento legal:** se vende una **licencia de uso de software**, NO servicios de trading,
asesoría de inversión ni administración de capital. Todo el contenido, los términos y los textos
deben reflejar esto (nunca prometer rentabilidad).

## 2. Personas

| Persona | Rol en el proyecto | Rol en la plataforma |
|---|---|---|
| **Argemiro** | Dueño del software y del negocio | Administrador — todos los permisos |
| **Desarrollador** (socio) | Desarrolla la plataforma y gana un % de las ventas | Administrador — todos los permisos + vista de sus comisiones |
| **Cliente** | Compra la licencia | Cliente |

## 3. Decisiones tomadas

### Negocio
- Solo se cobra la **licencia/suscripción al software**. No hay cobro por desempeño ni % de ganancias.
- **Plan inicial:** 3 meses (90 días) — **COP 2.000.000** o **USD/USDT 500**.
- Planes, precios y duración **editables desde el panel de administrador** (se pueden crear más planes).
- **No se requiere facturación electrónica.**
- Capital mínimo y niveles de riesgo: los define Argemiro **por cliente**, después de montada la
  plataforma. Varían según el monto, el riesgo y el % que el cliente quiera asumir.
  → La plataforma debe permitir que el admin registre esa configuración en la ficha de cada cliente.

### Pagos
- **No recurrentes ni automáticos.** El cliente recibe recordatorios y entra a pagar manualmente.
- Modelo de **periodos prepagados**: al confirmarse el pago, se activan/extienden los días del plan.
  - Si renueva antes de vencer, los días se suman a partir de la fecha de vencimiento actual.
- **Cripto:** Binance (Argemiro ya tiene cuenta).
  - Monedas permitidas: **USDT (TRC20 y BEP20), BTC**, y opcionalmente **ETH / USDC**.
  - Binance Pay (checkout + confirmación automática) para quienes pagan desde Binance.
  - Depósito directo a dirección de Binance (TRC20/BEP20/BTC) para quienes pagan desde otra
    billetera: el cliente reporta el hash de la transacción y el admin aprueba (o se verifica vía API).
- **COP:** pasarela colombiana **pendiente de definir** (Wompi, ePayco, Mercado Pago…).
- **Respaldo:** pago manual con carga de comprobante + aprobación del admin.

### Conexión de cuentas
- **Manual.** Argemiro conecta y desconecta cada cuenta en su servicio de copy trading.
- La plataforma solo debe: (1) saber quién pagó y quién no, (2) guardar los datos de la cuenta de
  cada cliente, y (3) mostrarle a Argemiro colas de trabajo: **"por conectar"** y **"por desconectar"**.
- Automatización por API: se evaluará más adelante (no se sabe aún si el servicio de copy la tiene).
- Los datos sensibles (contraseña de la cuenta de trading) se guardan **cifrados** y solo los
  administradores pueden verlos.

### Contenido
- Argemiro tiene una cuenta **auditada en Myfxbook (~2 años)** → se mostrará el **widget de Myfxbook**
  con estadísticas e historial reales.
- Sección de **preguntas frecuentes** editable desde el panel (depósitos, retiros, brokers, etc.).
  Los depósitos y retiros los hace cada cliente directamente con su broker.

### Tecnología
- **Backend: NestJS** (el desarrollador lo está aprendiendo) + TypeScript.
- **Frontend: Next.js (React)** + Tailwind — confirmado.
- Base de datos: **PostgreSQL** con **Prisma** como ORM.
- Correos: Resend (o similar). Tareas programadas (recordatorios): `@nestjs/schedule`.
- Hosting propuesto: frontend en Vercel; API NestJS + Postgres en Railway / Render / Supabase (DB).

## 4. Flujo del cliente

1. Visita la landing → ve planes, cómo funciona, widget de Myfxbook y FAQ.
2. Se registra (verifica correo, acepta términos de licencia y aviso de riesgo).
3. Elige plan y método de pago (COP o cripto) → pago **pendiente**.
4. Pago confirmado (webhook o aprobación del admin) → suscripción **activa** (inicio + 90 días).
5. Completa el formulario de su cuenta de trading → entra a la cola **"por conectar"**.
6. Argemiro la conecta manualmente y la marca como **conectada** → el cliente recibe correo.
7. Recordatorios de vencimiento: 7, 3 y 1 día antes y el día del vencimiento.
8. Si renueva → se suman los días. Si no → **vencida** → entra a la cola **"por desconectar"**.
9. Argemiro la desconecta y la marca como **desconectada**.

## 5. Módulos

### Público
Inicio · Cómo funciona · Planes y precios · Resultados (widget Myfxbook) · Brokers · FAQ ·
Contacto (WhatsApp/Telegram) · Términos de licencia · Privacidad (Ley 1581/2012) · Aviso de riesgo ·
Política de reembolsos.

### Panel del cliente
Estado de la suscripción y días restantes · Renovar/pagar · Historial de pagos ·
Datos de la cuenta de trading (editar) · Estado de conexión · Configuración asignada
(riesgo/capital, solo lectura) · Soporte.

### Panel de administración (Argemiro y socio desarrollador)
- **Dashboard:** ventas del día/mes/año, ingresos por método (COP vs cripto), clientes activos,
  nuevos, renovaciones, vencimientos próximos.
- **Suscripciones:** cliente, plan, inicio, vencimiento, **días restantes**, estado; filtros
  (vence en 7 días, vencidas, pendientes de pago).
- **Pagos:** listado, aprobar/rechazar pagos manuales y cripto, ver comprobantes y hashes.
- **Colas de trabajo:** por conectar / por desconectar.
- **Clientes:** ficha completa, datos de la cuenta (descifrados solo aquí), configuración de
  riesgo/capital, notas internas, activar/suspender, extender días manualmente.
- **Configuración:** planes y precios (COP y USD), monedas/redes cripto, direcciones de billetera,
  FAQ, brokers recomendados, enlaces de contacto, widget de Myfxbook.
- **Socios / comisiones:** % del socio desarrollador sobre las ventas, comisión acumulada por
  periodo, pagos de comisión registrados.
- **Auditoría:** registro de quién hizo qué (aprobaciones, cambios de precios, vistas de credenciales).
- Exportar a CSV/Excel.

### Automatizaciones
Correos: bienvenida, pago recibido, pago confirmado, cuenta conectada, recordatorios de
vencimiento, suscripción vencida. Alertas al admin: nueva venta, pago por aprobar, cuenta por
conectar, cuenta por desconectar.

## 6. Modelo de datos (borrador)

`User` (rol: ADMIN | CLIENT) · `Plan` (nombre, días, precio COP, precio USD, activo) ·
`Subscription` (usuario, plan, inicio, fin, estado) ·
`Payment` (usuario, plan, método, moneda, red, monto, hash/referencia, comprobante, estado, aprobado por) ·
`TradingAccount` (usuario, broker, servidor, plataforma, número, contraseña cifrada,
estado de conexión, config de riesgo/capital) ·
`Faq` · `Broker` · `Setting` · `PartnerShare` (socio, %, vigencia) · `CommissionPayout` ·
`Notification` · `AuditLog`

## 7. Fases

- **Fase 1 (MVP):** landing + FAQ + Myfxbook, registro/login, planes editables, pagos cripto
  (Binance Pay + depósito con aprobación), pago manual con comprobante, panel cliente, panel admin
  (ventas, suscripciones, colas, clientes, configuración, comisiones), recordatorios por correo.
- **Fase 1.5:** pasarela COP (cuando Argemiro la tenga aprobada).
- **Fase 2:** referidos/afiliados, cupones, notificaciones por WhatsApp/Telegram, tickets de
  soporte, versión en inglés.
- **Fase 3:** conexión/desconexión automática vía API del servicio de copy trading (si existe).
