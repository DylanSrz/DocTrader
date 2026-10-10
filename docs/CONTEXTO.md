# Contexto del proyecto — Plataforma Doc Trader Pro AI

> Última actualización: 2026-10-10 (TypeORM, comisión, pagos solo cripto, licencia por cuenta, gracia, marca)
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
| **Desarrollador** (socio) | Desarrolla la plataforma y gana un % de las ventas | Administrador — todos los permisos + su perfil de socio con su comisión |
| **Cliente** | Compra licencias | Cliente |

## 3. Decisiones tomadas

### Licencias y precios
- Solo se cobra la **licencia de uso del software**. No hay cobro por desempeño ni % de ganancias.
- **Una licencia por cada cuenta de trading.** Un cliente con dos cuentas compra dos licencias.
- **Precios en USD.** Si se cobra en pesos, es el equivalente a la **TRM oficial del día**
  (Superintendencia Financiera), **redondeado a los 1.000 pesos** más cercanos.

| Licencia | Precio | Duración | Notas |
|---|---|---|---|
| **Trimestral** | USD 319 | 3 meses | Sin obsequio. Se renueva al mismo precio |
| **Semestral** | USD 499 | 6 meses = 5 + 1 de obsequio | El mes de obsequio es un cupón que se aplica solo. La renovación cuesta lo mismo y también lo lleva |
| **Prueba** | USD 50 | 1 mes | No pública: el cliente la solicita y el admin la aprueba. Una por cliente |
| **Completar prueba** | USD 450 | +5 meses | Solo completa a la semestral. Hasta el último día de la prueba; los 5 meses se suman al final de la prueba; sin obsequio (6 meses por USD 500 en total) |

- Un cliente trimestral puede **pasarse a la semestral antes de vencer**; los días se suman.
- Si la prueba vence sin completarse, para continuar compra una licencia trimestral o semestral nueva.
- **No hay devoluciones.**
- Planes, precios, duración y el mes de obsequio son **editables desde el panel de administrador**.
- **No se requiere facturación electrónica.**
- Capital mínimo y nivel de riesgo: los define Argemiro **por cuenta**, después de montada la plataforma.

### Vencimiento y gracia
- Recordatorios: 7, 3 y 1 día antes y el día del vencimiento.
- Al vencer hay **3 días de gracia** (editable desde el panel de admin). Pasada la gracia sin renovar,
  la cuenta entra a la lista **"por desconectar"**.

### Pagos
- **Manuales y no recurrentes.** El cliente recibe recordatorios y entra a pagar.
- Modelo de **periodos prepagados**: si renueva antes de vencer, los días se suman desde el vencimiento actual.
- **Lanzamiento: solo cripto.** Monedas: **USDT, USDC y BTC**.
  - **Binance Pay:** Argemiro ya lo tiene. Para la confirmación automática se necesita la API de
    Binance Pay **Merchant** (llaves de comerciante); a confirmar.
  - **Depósito directo:** el admin **agrega desde el panel todas las direcciones de depósito** que
    quiera (moneda + red + dirección, activables). El cliente envía, reporta el hash y el admin aprueba.
- **Orden de pago válida por 1 hora.** Pasada la hora, expira y el cliente genera otra.
- **Pasarela en pesos (COP): fuera del lanzamiento**, queda como funcionalidad futura.

### Comisión del socio desarrollador
- **10 % de las ventas**, editable por el desarrollador **desde su perfil de socio**.
- Salvaguardas propuestas: cada cambio aplica solo a ventas posteriores, queda en el registro de
  auditoría y Argemiro recibe un aviso.

### Conexión de cuentas
- **Manual.** Argemiro conecta y desconecta cada cuenta en su servicio de copy trading.
- La plataforma: (1) sabe quién pagó y quién no, (2) guarda los datos de cada cuenta y (3) muestra
  las listas **"por conectar"** y **"por desconectar"**.
- **Datos de cada cuenta de trading:** nombre completo, número de cuenta, broker, servidor,
  contraseña operativa (maestra) y contraseña de inversor. Ambas contraseñas **cifradas**; solo los
  admins las ven y cada consulta queda en auditoría.
- **LPOA firmado:** **uno por cliente** (no por cuenta). El cliente descarga la plantilla de Argemiro,
  la firma y la sube. Se pide después de pagar y antes de conectar: ninguna cuenta del cliente entra a
  "por conectar" hasta que un admin aprueba su LPOA. Archivo privado (solo admins).
- Automatización por API: se evaluará más adelante.

### Registro y soporte
- Registro con **datos básicos de contacto**: nombre completo, correo y teléfono (WhatsApp/Telegram).
- **Soporte por Telegram.**

### Contenido y marca
- Widget de **Myfxbook** de la cuenta auditada (~2 años).
- Preguntas frecuentes editables desde el panel. Depósitos y retiros los hace cada cliente con su broker.
- **Broker sugerido:** JustMarkets (único por ahora), link de referido
  `https://one.justmarkets.link/a/5vmbn05zda`, como "¿No sabes qué broker elegir? Yo uso este",
  aclarando que es un enlace de referido y que el cliente puede usar cualquier broker.
- **Marca:** Argemiro tiene un logo básico (pendiente de recibir); los colores salen del logo.
  **Tipografías y estilos los define el desarrollo**, guiados por una página de referencia (pendiente).
- **Objetivo: un excelente UI/UX** en la página pública y en ambos paneles.

### Tecnología
- **Backend: NestJS** + TypeScript.
- **Frontend: Next.js (React)** + Tailwind.
- Base de datos: **PostgreSQL** con **TypeORM**.
- Correos: Resend (o similar). Tareas programadas (recordatorios, gracia, expiración de órdenes,
  TRM diaria): `@nestjs/schedule`.
- Hosting propuesto: frontend en Vercel; API NestJS + Postgres en Railway / Render.

## 4. Flujo del cliente

1. Visita la landing → ve licencias, cómo funciona, widget de Myfxbook, broker sugerido y FAQ.
2. Se registra con sus datos de contacto (verifica correo, acepta términos y aviso de riesgo).
3. Elige licencia (trimestral, semestral, o prueba si se la aprobaron) para una cuenta de trading →
   orden de pago **pendiente** (válida 1 hora).
4. Pago confirmado (Binance Pay o aprobación del admin) → licencia **activa**.
   - En prueba: ve el botón **"Completar a semestral — USD 450"** hasta el último día de la prueba.
5. Registra los datos de esa cuenta de trading. Si aún no tiene LPOA aprobado, lo descarga, lo firma
   y lo sube → un admin lo aprueba → la cuenta entra a **"por conectar"**.
6. Argemiro la conecta y la marca como **conectada** → el cliente recibe correo.
7. Recordatorios 7, 3 y 1 día antes y el día del vencimiento.
8. Si renueva → se suman los días. Si no → **vencida** → 3 días de gracia → **"por desconectar"**.
9. Argemiro la desconecta y la marca como **desconectada**.

## 5. Módulos

### Público
Inicio · Cómo funciona · Licencias y precios · Resultados (Myfxbook) · Broker sugerido · FAQ ·
Contacto (Telegram) · Términos de licencia · Privacidad (Ley 1581/2012) · Aviso de riesgo ·
Política de no devoluciones.

### Panel del cliente
Mis cuentas de trading, cada una con su licencia, estado, vencimiento y días restantes ·
Comprar / renovar / pasar a semestral · Solicitar prueba · LPOA (descargar, subir, estado) ·
Historial de pagos · Capital y riesgo asignados (solo lectura) · Soporte por Telegram.

### Panel de administración (Argemiro y socio desarrollador)
- **Dashboard:** ventas del día/mes/año, por moneda, cuentas activas, nuevas, renovaciones, por vencer.
- **Licencias:** cuenta, cliente, plan, inicio, vencimiento, días restantes, estado; filtros
  (vence en 7 días, en gracia, vencidas, pendientes de pago, en prueba).
- **Pagos:** aprobar/rechazar depósitos con hash, ver órdenes expiradas.
- **Solicitudes de prueba** y **LPOA** por aprobar.
- **Listas de trabajo:** por conectar / por desconectar.
- **Clientes y cuentas:** ficha, datos de la cuenta (contraseñas con acción explícita), capital y
  riesgo, notas, extender días, suspender.
- **Configuración:** planes y precios, mes de obsequio, **días de gracia**, **direcciones de depósito**
  (moneda, red, dirección), FAQ, broker sugerido, enlace de Telegram, widget de Myfxbook.
- **Mi perfil de socio** (desarrollador): % de comisión, comisión por periodo, pagos recibidos.
- **Auditoría** y exportar a Excel/CSV.

### Automatizaciones
Correos: bienvenida, orden creada, pago confirmado/rechazado, prueba aprobada, LPOA aprobado/rechazado,
cuenta conectada, recordatorios de vencimiento y de completar prueba, licencia vencida, fin de gracia.
Alertas a admins: nueva venta, pago por aprobar, solicitud de prueba, LPOA por revisar, cuenta por
conectar, cuenta por desconectar, cambio de % de comisión.

## 6. Modelo de datos (borrador, entidades TypeORM)

`User` (rol ADMIN | CLIENT, nombre, correo, teléfono, prueba usada) ·
`PartnerProfile` (usuario socio, % de comisión) · `CommissionRateChange` (anterior, nuevo, fecha) ·
`CommissionPayout` ·
`Plan` (tipo TRIMESTRAL | SEMESTRAL | PRUEBA | COMPLETAR_PRUEBA, meses, meses de obsequio, precio USD, visible, activo) ·
`ExchangeRate` (fecha, TRM COP/USD) ·
`TradingAccount` (cliente, titular, broker, servidor, número, contraseña operativa cifrada,
contraseña de inversor cifrada, estado de conexión, capital y riesgo) ·
`License` (cuenta de trading, plan, inicio, fin, fin de gracia, estado, es_prueba) ·
`PaymentOrder` (licencia, plan, moneda, red, dirección, monto, expira en, hash, estado, aprobado por) ·
`DepositAddress` (moneda, red, dirección, activa) ·
`LpoaDocument` (cliente — uno por cliente, archivo privado, estado PENDIENTE | APROBADO | RECHAZADO, revisado por) ·
`TrialRequest` · `Faq` · `Setting` (días de gracia, Telegram, Myfxbook, broker) · `Notification` · `AuditLog`

## 7. Fases

- **Fase 1 (lanzamiento):** landing + FAQ + Myfxbook + broker sugerido, registro/login, licencias
  trimestral/semestral/prueba, pagos cripto (Binance Pay + depósito directo con aprobación),
  LPOA, panel del cliente, panel de admin, perfil de socio, recordatorios y gracia.
- **Fase 2:** pasarela en pesos (COP), referidos, cupones adicionales, avisos por Telegram/WhatsApp,
  tickets de soporte, versión en inglés.
- **Fase 3:** conexión/desconexión automática vía API del servicio de copy trading (si existe).
