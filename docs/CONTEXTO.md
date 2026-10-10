# Contexto del proyecto — Plataforma Doc Trader Pro AI

> Última actualización: 2026-10-10 (TRM para todas las licencias, LPOA único por cliente)
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
- **Precios en USD.** En pesos se cobra el **equivalente a la TRM del día** en que se paga, para todas las licencias.
  - TRM oficial de la **Superintendencia Financiera**; el valor en pesos se **redondea a los 1.000 pesos** más cercanos.
- **Licencia normal: USD 499** = 5 meses pagados + **1 mes de obsequio** = **6 meses**.
  - El mes de obsequio es un cupón que **se aplica automáticamente** a toda compra (el cliente no
    escribe ningún código). El admin puede cambiarlo o desactivarlo.
  - La **renovación cuesta lo mismo** y también incluye el mes de obsequio.
- **Licencia trimestral: USD 319** por 3 meses (sin mes de obsequio). Visible en la página pública.
  - Se renueva al mismo precio.
  - Un cliente trimestral puede **pasarse a la licencia normal antes de vencer**; los días se suman.
  - Se descartó un plan semestral de USD 599: la opción de 6 meses es la licencia normal (5 + 1) de USD 499.
- **Licencia de prueba: 1 mes por USD 50.**
  - **No se ofrece públicamente:** solo si el cliente la solicita (el admin la habilita).
  - Una sola prueba por cliente.
  - Cómo se pide: botón **"Solicitar prueba"** en el panel del cliente → Argemiro la aprueba →
    el cliente paga los USD 50.
  - Si al cliente le gustó, **completa con USD 450** y recibe **5 meses más** (sin mes de obsequio), que se suman al final
    de la prueba (total: 6 meses por USD 500 desde el inicio de la prueba).
  - Plazo para completar: **hasta el último día de la prueba**.
  - Si no completa a tiempo, para continuar paga una **licencia normal de 6 meses (USD 499)**.
- **No hay devoluciones** ni periodo de prueba gratis.
- Planes, precios, duración y cupones **editables desde el panel de administrador**.
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
- **Cupones:** el admin crea cupones que suman días (ej. +1 mes de obsequio) o descuentan valor.

### Conexión de cuentas
- **Manual.** Argemiro conecta y desconecta cada cuenta en su servicio de copy trading.
- La plataforma solo debe: (1) saber quién pagó y quién no, (2) guardar los datos de la cuenta de
  cada cliente, y (3) mostrarle a Argemiro colas de trabajo: **"por conectar"** y **"por desconectar"**.
- Automatización por API: se evaluará más adelante (no se sabe aún si el servicio de copy la tiene).
- **Datos que el cliente entrega para la conexión:**
  1. Nombre completo
  2. Número de cuenta de trading
  3. Nombre del broker
  4. Servidor del broker
  5. Contraseña operativa (maestra)
  6. Contraseña de inversor
- **LPOA firmado (poder limitado):** **uno por cliente** (no por cuenta). El cliente descarga la plantilla que entrega Argemiro, la firma y
  la sube como archivo. Se pide **después de pagar y antes de conectar**: la cuenta solo entra a la
  lista "por conectar" cuando un admin aprueba el LPOA. El archivo se guarda privado (solo admins).
- Ambas contraseñas se guardan **cifradas** y solo los administradores pueden verlas
  (cada consulta queda en el registro de auditoría).

### Contenido
- Argemiro tiene una cuenta **auditada en Myfxbook (~2 años)** → se mostrará el **widget de Myfxbook**
  con estadísticas e historial reales.
- Sección de **preguntas frecuentes** editable desde el panel (depósitos, retiros, brokers, etc.).
  Los depósitos y retiros los hace cada cliente directamente con su broker.
- **Broker sugerido por Argemiro:** JustMarkets, con su link de referido
  `https://one.justmarkets.link/a/5vmbn05zda`. Se muestra como "¿No sabes qué broker elegir? Yo uso este",
  aclarando que es un enlace de referido y que el cliente puede usar cualquier broker.

### Tecnología
- **Backend: NestJS** (el desarrollador lo está aprendiendo) + TypeScript.
- **Frontend: Next.js (React)** + Tailwind — confirmado.
- Base de datos: **PostgreSQL** con **Prisma** como ORM.
- Correos: Resend (o similar). Tareas programadas (recordatorios): `@nestjs/schedule`.
- Hosting propuesto: frontend en Vercel; API NestJS + Postgres en Railway / Render / Supabase (DB).

## 4. Flujo del cliente

1. Visita la landing → ve planes, cómo funciona, widget de Myfxbook y FAQ.
2. Se registra (verifica correo, acepta términos de licencia y aviso de riesgo).
3. Elige plan (normal, o prueba si el admin se la habilitó), aplica cupón y método de pago
   (COP o cripto) → pago **pendiente**.
4. Pago confirmado (webhook o aprobación del admin) → licencia **activa** (inicio + días del plan
   + días del cupón).
   - Si es prueba: durante el mes ve el botón **"Completar licencia — USD 450"**, que le suma 5 meses.
5. Completa el formulario de su cuenta de trading y sube su **LPOA firmado** → un admin aprueba el LPOA →
   la cuenta entra a la cola **"por conectar"**.
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
  FAQ, broker sugerido (por ahora solo JustMarkets), enlaces de contacto, widget de Myfxbook.
- **Socios / comisiones:** % del socio desarrollador sobre las ventas, comisión acumulada por
  periodo, pagos de comisión registrados.
- **Auditoría:** registro de quién hizo qué (aprobaciones, cambios de precios, vistas de credenciales).
- Exportar a CSV/Excel.

### Automatizaciones
Correos: bienvenida, pago recibido, pago confirmado, cuenta conectada, recordatorios de
vencimiento, suscripción vencida. Alertas al admin: nueva venta, pago por aprobar, cuenta por
conectar, cuenta por desconectar.

## 6. Modelo de datos (borrador)

`User` (rol: ADMIN | CLIENT; prueba habilitada / usada) ·
`Plan` (nombre, tipo NORMAL | TRIMESTRAL | PRUEBA | COMPLETAR_PRUEBA, días, precio USD, visible, activo;
el precio COP se calcula con la TRM del día) · `ExchangeRate` (fecha, TRM COP/USD) ·
`Coupon` (código, días extra o descuento, vigencia, usos) ·
`Subscription` (usuario, plan, inicio, fin, estado, es_prueba) ·
`Payment` (usuario, plan, método, moneda, red, monto, hash/referencia, comprobante, estado, aprobado por) ·
`LpoaDocument` (usuario — uno por cliente, archivo privado, estado PENDIENTE | APROBADO | RECHAZADO, revisado por) ·
`TradingAccount` (usuario, nombre completo del titular, broker, servidor, número de cuenta,
contraseña operativa cifrada, contraseña de inversor cifrada, estado de conexión,
config de riesgo/capital) ·
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
