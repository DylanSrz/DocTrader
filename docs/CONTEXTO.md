# Contexto del proyecto — Plataforma Doc Trader Pro AI

> Última actualización: 2026-10-14 (titular, textos legales, seguridad, cuentas de servicio y decisiones técnicas).
> Antes: 2026-10-12 (reunión con Argemiro: propuesta 2 elegida, licencia mensual, semestral 6 + 1, prueba de 15 días
> con control antiabuso, tickets de soporte, correo oficial)
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
| **Dylan** (desarrollador y socio) | Desarrolla la plataforma y gana un % de las ventas | Administrador — todos los permisos + su perfil de socio con su comisión |
| **Cliente** | Compra licencias | Cliente |

## 3. Decisiones tomadas

### Licencias y precios
- Solo se cobra la **licencia de uso del software**. No hay cobro por desempeño ni % de ganancias.
- **Una licencia por cada cuenta de trading.** Un cliente con dos cuentas compra dos licencias.
- **Precios en USD.** Si se cobra en pesos, es el equivalente a la **TRM oficial del día**
  (Superintendencia Financiera), **redondeado a los 1.000 pesos** más cercanos.

| Licencia | Precio | Duración | Notas |
|---|---|---|---|
| **Mensual** | USD 120 | 1 mes | Sin obsequio. Se renueva al mismo precio (nueva el 2026-10-12) |
| **Trimestral** | USD 319 | 3 meses | Sin obsequio. Se renueva al mismo precio |
| **Semestral** | USD 499 | **7 meses = 6 + 1 de obsequio** | El mes de obsequio es un cupón que se aplica solo. La renovación cuesta lo mismo y también lo lleva (antes era 5 + 1; cambió el 2026-10-12) |
| **Prueba** | USD 50 | **15 días** | No se compra directo: la landing invita a solicitarla y el admin la aprueba. **Una sola vez por cliente y por cuenta de trading** (ver "Control de la prueba") |
| **Completar la prueba** | La diferencia: USD 70 (mensual), USD 269 (trimestral) o USD 449 (semestral) | La del plan elegido | Hasta el último día de la prueba. Los USD 50 se abonan y los 15 días hacen parte del plan: la licencia cuenta desde el día en que empezó la prueba. A semestral lleva el mes de obsequio (7 meses en total; confirmado el 2026-10-12) |

- **Cambio de plan antes de vencer:** un mensual puede pasarse a trimestral o semestral, y un trimestral a semestral.
  Se paga el plan nuevo completo y los días se suman al vencimiento actual.
- La diferencia para completar la prueba se calcula sola con los precios vigentes (precio del plan − precio de la prueba).
- Si la prueba vence sin completarse, para continuar compra una licencia nueva al precio completo.
- **No hay devoluciones.**
- Planes, precios, duración y el mes de obsequio son **editables desde el panel de administrador**.
- **No se requiere facturación electrónica.**
- Capital mínimo y nivel de riesgo: los define Argemiro **por cuenta**, después de montada la plataforma.

### Control de la prueba (una sola vez por persona y por cuenta)
Pedido de Argemiro: que nadie pueda saltarse la regla, ni registrándose con otro nombre ni con la misma cuenta de trading.
Se combinan bloqueos automáticos, señales para el admin y reglas sobre la cuenta en prueba. Ninguna medida sola es
infalible; juntas hacen que repetir la prueba exija otra persona, otra cuenta en el broker, otro teléfono, otro
dispositivo y otra billetera, y aun así el admin ve las coincidencias antes de aprobar.

**1. Bloqueos automáticos** (la plataforma no deja enviar la solicitud):
- **Cédula** que ya tuvo prueba (se compara solo con dígitos, sin puntos ni espacios).
- **Cuenta de trading** que ya tuvo prueba, sin importar qué cliente la registre: se compara el número de cuenta junto
  con el broker y el servidor normalizados (minúsculas, sin espacios ni guiones).
- **Correo o teléfono** ya ligados a una prueba. El correo se normaliza (minúsculas; en Gmail se ignoran los puntos y
  lo que va después de "+") y el teléfono se guarda en formato internacional.
- Una solicitud solo se puede hacer con el correo y el teléfono **verificados**: código al correo y **código por SMS**
  al teléfono (confirmado el 2026-10-12; cada SMS tiene un costo).

**2. Señales para el admin** (no bloquean, pero aparecen junto a la solicitud, que siempre requiere aprobación):
- El mismo **número de cuenta** usado antes en otro broker.
- **Titular** de la cuenta de trading parecido al de una prueba anterior.
- Mismo **dispositivo** (identificador guardado en el navegador) o misma **IP** que una prueba anterior.
- La **billetera de origen** del pago de USD 50 ya pagó otra prueba. La verificación en blockchain conoce la dirección
  que envía; se ignoran las direcciones de exchanges (Binance y similares), que comparten muchos usuarios.

**3. Reglas sobre la cuenta en prueba:**
- El **titular** de la cuenta de trading debe ser el cliente registrado. Argemiro lo confirma al conectarla en
  Social Trader Tools (el broker muestra el nombre del titular) y rechaza la prueba si no coincide.
- Durante la prueba no se puede cambiar el número de cuenta, el broker ni el servidor de esa licencia.
- La prueba se paga y se conecta como cualquier licencia: sin pago verificado no hay conexión.

**4. Registro de pruebas que no se borra:** de cada prueba se guarda una huella (hash con clave secreta, HMAC) de la
cédula, la cuenta de trading, el correo, el teléfono, el dispositivo y la billetera. Se conserva aunque el cliente
elimine su cuenta, para que la regla no se pueda saltar borrando el registro. La política de tratamiento de datos
debe informar esta finalidad (prevención de fraude en la prueba).

**Opcional, apagado por defecto:** pedir foto de la cédula para aprobar la prueba si se detecta abuso.

### Vencimiento y gracia
- Recordatorios: 7, 3 y 1 día antes y el día del vencimiento.
- Al vencer hay **3 días de gracia** (editable desde el panel de admin). Pasada la gracia sin renovar,
  la cuenta entra a la lista **"por desconectar"**.

### Pagos
- **Manuales y no recurrentes.** El cliente recibe recordatorios y entra a pagar.
- Modelo de **periodos prepagados**: si renueva antes de vencer, los días se suman desde el vencimiento actual.
- **Solo cripto por ahora** (sin transferencias ni pesos). Monedas y redes:
  **USDT en Tron (TRC20)**, **USDC en BNB Smart Chain (BEP20)** y **BTC en la red Bitcoin**.
  - **Depósito directo (método principal al lanzar):** el admin **agrega desde el panel todas las direcciones de depósito** que
    quiera (moneda + red + dirección, activables). El cliente envía, reporta el hash y el admin aprueba.
  - **Verificación automática en blockchain:** cuando el cliente reporta el hash, la plataforma consulta
    la blockchain pública (Tron para USDT TRC20, BNB Smart Chain para USDC BEP20, Bitcoin para BTC) y revisa:
    1. que el hash no se haya usado antes en otra orden;
    2. que el destino sea la dirección de depósito de la orden y la moneda/contrato sea el correcto;
    3. que el monto sea **igual o mayor** al de la orden (si es menor, se marca "monto incompleto");
    4. que la transacción sea posterior a la creación de la orden;
    5. que tenga las confirmaciones mínimas (propuesto: Tron 20, BNB Smart Chain 15, Bitcoin 2; editables).
    El resultado (Verificado / No coincide / Esperando confirmaciones) se muestra al admin junto a la orden,
    que la aprueba con un clic. Opción en el panel, **apagada por defecto**: aprobar sola las órdenes verificadas.
    Si el cliente no reporta el hash, el sistema puede detectar el depósito buscando el monto exacto en la dirección.
  - **BTC:** el monto en BTC se calcula al crear la orden con el precio del momento y queda fijo durante la hora.
  - **Binance Pay Merchant: en trámite.** Argemiro ya solicitó la cuenta de comerciante y espera la
    aprobación. Se integra cuando Binance la apruebe (confirmación automática); mientras tanto todo pago
    entra por depósito directo con aprobación manual. El sistema se diseña para agregarlo sin rehacer nada.
- **Orden de pago válida por 1 hora.** Pasada la hora, expira y el cliente genera otra.
- **Pasarela en pesos (COP): fuera del lanzamiento**, queda como funcionalidad futura.

### Comisión del socio desarrollador
- **10 % del valor bruto de las ventas**, editable por el desarrollador **desde su perfil de socio**.
- Se liquida **los días 15 y 30 de cada mes** (en febrero, el último día del mes).
- Salvaguardas propuestas: cada cambio aplica solo a ventas posteriores, queda en el registro de
  auditoría y Argemiro recibe un aviso.

### Conexión de cuentas
- **Manual.** Argemiro conecta y desconecta cada cuenta en su servicio de copy trading:
  **Social Trader Tools**.
- La plataforma: (1) sabe quién pagó y quién no, (2) guarda los datos de cada cuenta y (3) muestra
  las listas **"por conectar"** y **"por desconectar"**.
- **Datos de cada cuenta de trading:** nombre completo, número de cuenta, broker, servidor,
  contraseña operativa (maestra) y contraseña de inversor. Ambas contraseñas **cifradas**; solo los
  admins las ven y cada consulta queda en auditoría.
- **No se pide LPOA** (decisión del 2026-10-10). Con la licencia pagada y los datos completos, la cuenta
  entra directamente a "por conectar".
- Automatización por API de Social Trader Tools: se evaluará en la fase 3.

### Registro y soporte
- Registro con **nombre completo, cédula (documento de identidad nacional), correo y teléfono**.
  La cédula es única por cliente y sirve para controlar que haya una sola prueba por persona. Se trata
  como dato personal protegido (Ley 1581 de 2012).
- **Correo oficial: support@doctraderpro.com** (decisión del 2026-10-13). Es el
  correo de contacto público y la dirección de respuesta (Reply-To) de todos los correos que envía la plataforma.
  - **Dominio propio: doctraderpro.com** (comprado en Hostinger, 2026-10-13).
  - **Buzón del dominio: support@doctraderpro.com** (correo de Hostinger). Otras direcciones
    (`contacto@`, `pagos@`) se crean como alias o reenvíos hacia ese buzón, sin pagar buzones extra.
  - Los correos automáticos (bienvenida, órdenes, recordatorios) salen por Resend desde el dominio verificado, con una
    dirección sin buzón como `notificaciones@doctraderpro.com`.
- **Soporte con tickets dentro de la plataforma** (decisión del 2026-10-12), que **convive con Telegram**: el ticket
  es el canal formal y queda registrado; Telegram sigue para dudas rápidas y comunidad.
  - El cliente abre un ticket desde su panel: tema (pagos, conexión de la cuenta, licencia, técnico, otro), cuenta
    de trading u orden relacionada (opcional), mensaje y adjuntos (imágenes o PDF, hasta 5 por mensaje y 10 MB cada uno).
  - Estados: **abierto** → **respondido** (espera al cliente) → **resuelto** → **cerrado**. Un ticket resuelto se
    cierra solo a los 7 días si el cliente no responde; antes de eso el cliente puede reabrirlo.
  - Los admins tienen una bandeja: filtros (sin responder, abiertos, por tema), asignar a Argemiro o al socio,
    prioridad, **notas internas** que el cliente no ve, respuestas guardadas y tiempo de primera respuesta.
  - Correos: al cliente con cada respuesta (con Reply-To al correo oficial); alerta a los admins con cada ticket nuevo.
- **Telegram:** https://t.me/+cdmWH_xLubdhMDhh
- **Instagram:** https://www.instagram.com/doctraderproiasystem/

### Titular y textos legales
- **Titular:** DocTraderPRO, Barranquilla, Colombia. Faltan su identificación (NIT o cédula), dirección y teléfono para
  la política de datos.
- Borradores en `docs/legal/` (2026-10-14), para revisar con un abogado antes de publicar:
  - `terminos-licencia.md`: licencia de uso, planes, prueba, pagos, sin devoluciones, gracia, responsabilidad.
  - `politica-datos.md`: Ley 1581, finalidades, huellas de la prueba, plazos de borrado, derechos y autorización.
  - `aviso-riesgo.md`: riesgo de pérdida, resultados pasados, enlace de referido; incluye una versión corta.
- **Plazos de borrado** que salen de la política: contraseñas de trading 90 días después de desconectar una cuenta que
  no renovó; foto del documento 30 días después de decidir la prueba; tickets 2 años; registros técnicos 12 meses;
  auditoría de admins 5 años.

### Cuentas de servicio
- Se crean con el correo de **Dylan (dylansrz96@gmail.com)**; los pagos los cubre Argemiro.
- Admins de la plataforma: Dylan (dylansrz96@gmail.com) y Argemiro (correo pendiente).

### Seguridad
Plan completo en `docs/SEGURIDAD.md`. Lo principal: segundo factor obligatorio para admins, sesiones en el servidor,
cifrado por campo de contraseñas de trading y cédula, cambio de direcciones de depósito con 24 horas de espera y aviso
a los dos admins, auditoría que no se puede editar y copias de seguridad probadas.

### Contenido y marca
- Widget de **Myfxbook** de la cuenta auditada (~2 años).
- Preguntas frecuentes editables desde el panel. Depósitos y retiros los hace cada cliente con su broker.
- **Broker sugerido:** JustMarkets (único por ahora), link de referido
  `https://one.justmarkets.link/a/5vmbn05zda`, como "¿No sabes qué broker elegir? Yo uso este",
  aclarando que es un enlace de referido y que el cliente puede usar cualquier broker.
- **Marca:** logo básico de Argemiro (recibido, en `design/marca/`); los colores salen del logo.
  **Tipografías y estilos los define el desarrollo**, guiados por la página de referencia de Argemiro (https://denmu.com/).
- **Propuestas de diseño** en `design/` (una carpeta por propuesta, logo compartido en `design/marca/`).
  Se presentaron dos el 2026-10-10. **Argemiro eligió la propuesta 2** el 2026-10-12: DESIGN.md de Refero (Dala)
  con los colores del logo e Inter, negro puro, el triángulo como unidad. Es la referencia para construir en Next.js.
  La propuesta 1 queda archivada en `design/propuesta-1/`.
- **Objetivo: un excelente UI/UX** en la página pública y en ambos paneles.

### Tecnología
- **Backend: NestJS** + TypeScript.
- **Frontend: Next.js (React)** + Tailwind.
- Base de datos: **PostgreSQL** con **TypeORM**.
- Correos: Resend (o similar).
- **Dominio doctraderpro.com** (DNS en Hostinger), repartido así:

  | Registro | Apunta a |
  |---|---|
  | `doctraderpro.com` y `www` | La web en Vercel |
  | `api.doctraderpro.com` | La API en Railway o Render |
  | MX del dominio raíz | Correo de Hostinger (`support@`) |
  | `send.doctraderpro.com` (MX y SPF) + DKIM | Resend, para los correos automáticos; convive con el correo de Hostinger |
  | DMARC (`_dmarc`) | Política del dominio, empezando en `p=none` |
- **Tareas en segundo plano en un proceso aparte (worker)**: recordatorios, gracia, expiración de
  órdenes, verificación en blockchain y cortes de comisión, con **BullMQ + Redis** (reintentos y sin
  ejecuciones duplicadas). Misma base de código que la API, distinto comando de arranque.
- **Repositorio único** con espacios de trabajo de pnpm: `apps/api` (NestJS: API + worker),
  `apps/web` (Next.js), `packages/shared` (tipos y reglas compartidas), `docker/` (entorno de desarrollo).
- **Docker solo en desarrollo:** `docker compose up` levanta PostgreSQL, Redis, Mailpit (correos de
  prueba) y Adminer (ver la base de datos). La API, el worker y la web corren en local con recarga
  automática (o también en contenedores, según prefiera el desarrollador).
- **Producción sin Docker:** web en Vercel; API, worker, PostgreSQL y Redis administrados en Railway o
  Render, desplegados desde el código. Migraciones de TypeORM como paso aparte antes de cada despliegue.

## 4. Flujo del cliente

1. Visita la landing → ve licencias, la invitación a solicitar la prueba, cómo funciona, widget de Myfxbook, broker
   sugerido y FAQ.
2. Se registra con nombre, cédula, correo y teléfono (verifica correo, acepta términos y aviso de riesgo).
3. Elige licencia (mensual, trimestral, semestral, o prueba de 15 días si se la aprobaron) para una cuenta de
   trading → orden de pago **pendiente** (válida 1 hora).
4. Pago confirmado (aprobación del admin; Binance Pay cuando esté aprobado) → licencia **activa**.
   - En prueba: ve las tres opciones para completarla pagando la diferencia (USD 70, 269 o 449) hasta el último
     día de la prueba.
5. Registra los datos de esa cuenta de trading → la cuenta entra a **"por conectar"**.
6. Argemiro la conecta y la marca como **conectada** → el cliente recibe correo.
7. Recordatorios 7, 3 y 1 día antes y el día del vencimiento.
8. Si renueva → se suman los días. Si no → **vencida** → 3 días de gracia → **"por desconectar"**.
9. Argemiro la desconecta y la marca como **desconectada**.

## 5. Módulos

### Público
Inicio · Cómo funciona · Licencias y precios · Resultados (Myfxbook) · Broker sugerido · FAQ ·
Contacto (correo oficial y Telegram) · Términos de licencia · Privacidad (Ley 1581/2012) · Aviso de riesgo ·
Política de no devoluciones.

### Panel del cliente
Mis cuentas de trading, cada una con su licencia, estado, vencimiento y días restantes ·
Comprar / renovar / cambiar a un plan más largo · Solicitar prueba y completarla ·
Historial de pagos · Capital y riesgo asignados (solo lectura) · **Soporte: mis tickets** (abrir, responder,
adjuntar, reabrir) y enlace a Telegram.

### Panel de administración (Argemiro y socio desarrollador)
- **Dashboard:** ventas del día/mes/año, por moneda, cuentas activas, nuevas, renovaciones, por vencer.
- **Licencias:** cuenta, cliente, plan, inicio, vencimiento, días restantes, estado; filtros
  (vence en 7 días, en gracia, vencidas, pendientes de pago, en prueba).
- **Pagos:** aprobar/rechazar depósitos con hash, ver órdenes expiradas.
- **Solicitudes de prueba** por aprobar, con los bloqueos y señales del control de la prueba.
- **Soporte:** bandeja de tickets con filtros, asignación, prioridad, notas internas y respuestas guardadas.
- **Listas de trabajo:** por conectar / por desconectar.
- **Clientes y cuentas:** ficha, datos de la cuenta (contraseñas con acción explícita), capital y
  riesgo, notas, extender días, suspender.
- **Configuración:** planes y precios (mensual, trimestral, semestral, prueba), mes de obsequio, **días de gracia**, **direcciones de depósito**
  (moneda, red, dirección), FAQ, broker sugerido, enlace de Telegram, widget de Myfxbook.
- **Mi perfil de socio** (desarrollador): % de comisión, comisión por periodo, pagos recibidos.
- **Auditoría** y exportar a Excel/CSV.

### Automatizaciones
Correos: bienvenida, orden creada, pago confirmado/rechazado, prueba aprobada,
cuenta conectada, recordatorios de vencimiento y de completar prueba, licencia vencida, fin de gracia,
respuesta a un ticket, ticket resuelto. Todos con Reply-To a support@doctraderpro.com.
Alertas a admins: nueva venta, pago por aprobar, solicitud de prueba, cuenta por
conectar, cuenta por desconectar, cambio de % de comisión, ticket nuevo o reabierto.

## 6. Modelo de datos (borrador, entidades TypeORM)

`User` (rol ADMIN | CLIENT, nombre, cédula única, correo, teléfono, prueba usada) ·
`PartnerProfile` (usuario socio, % de comisión) · `CommissionRateChange` (anterior, nuevo, fecha) ·
`CommissionPayout` (periodo 1–15 o 16–fin de mes, ventas brutas, %, monto, pagado) ·
`Plan` (tipo MENSUAL | TRIMESTRAL | SEMESTRAL | PRUEBA, duración en días o meses, meses de obsequio, precio USD, visible, activo) ·
`ExchangeRate` (fecha, TRM COP/USD) ·
`TradingAccount` (cliente, titular, broker, servidor, número, contraseña operativa cifrada,
contraseña de inversor cifrada, estado de conexión, capital y riesgo) ·
`License` (cuenta de trading, plan, inicio, fin, fin de gracia, estado, es_prueba) ·
`PaymentOrder` (licencia, plan, tipo NUEVA | RENOVACION | CAMBIO_DE_PLAN | COMPLETAR_PRUEBA, moneda, red, dirección, monto, tasa BTC, expira en, hash único, estado de
verificación, confirmaciones, monto recibido, billetera de origen, aprobado por) · `ChainSetting` (red, confirmaciones mínimas, aprobación automática) ·
`DepositAddress` (moneda, red, dirección, activa) ·
`TrialRequest` (cliente, cuenta de trading, estado, bloqueos y señales encontrados) ·
`TrialRegistry` (huellas HMAC de cédula, cuenta, correo, teléfono, dispositivo y billetera; no se borra) ·
`SupportTicket` (cliente, tema, cuenta u orden relacionada, estado, prioridad, asignado a, primera respuesta) ·
`TicketMessage` (autor, texto, interna sí/no) · `TicketAttachment` (archivo, tipo, tamaño) · `Faq` · `Setting` (días de gracia, Telegram, Myfxbook, broker) · `Notification` · `AuditLog`

## 7. Fases

- **Fase 1 (lanzamiento):** landing + FAQ + Myfxbook + broker sugerido, registro/login, licencias
  mensual/trimestral/semestral/prueba (con control antiabuso), **tickets de soporte**, pagos cripto por depósito directo con aprobación (Binance Pay Merchant en cuanto Binance lo apruebe),
  panel del cliente, panel de admin, perfil de socio, recordatorios y gracia.
- **Fase 2:** pasarela en pesos (COP), referidos, cupones adicionales, avisos por Telegram/WhatsApp,
  versión en inglés.
- **Fase 3:** conexión/desconexión automática vía API de Social Trader Tools (si la ofrece).
