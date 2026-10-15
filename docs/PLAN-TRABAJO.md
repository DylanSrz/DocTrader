# Plan de trabajo

> 2026-10-14. Cómo se construye la fase 1 (lanzamiento). Alcance en `CONTEXTO.md` §7; datos y estados en
> `MODELO-DATOS.md`; seguridad en `SEGURIDAD.md`; servicios en `DECISIONES-TECNICAS.md`. Diseño de referencia:
> `design/propuesta-2/` (landing, panel del cliente y panel de admin).

## 1. Cómo se trabaja

- **Repositorio:** monorepo pnpm con `apps/api` (NestJS: API y worker), `apps/web` (Next.js) y `packages/shared`
  (tipos, esquemas de validación y reglas de negocio puras, como el cálculo de fechas y precios).
- **Ramas:** `main` protegida. Cada etapa se hace en ramas cortas que entran por pull request con las pruebas en verde.
- **Hecho** significa: funciona en el entorno de pruebas, tiene sus pruebas automáticas, cumple el diseño de la
  propuesta 2 en celular y escritorio, y deja registro en la auditoría cuando corresponde.
- Al cerrar cada etapa se le muestra a Argemiro en el entorno de pruebas.

## 2. Entornos

| Entorno | Dónde | Datos | Para qué |
|---|---|---|---|
| **Desarrollo** | En el computador, con Docker Compose: PostgreSQL, Redis, Mailpit (correos de prueba) y Adminer | Ficticios, cargados con un script | Programar |
| **Pruebas** | Vercel (vista previa de cada pull request) y un entorno de Railway con su propia base de datos | Ficticios | Revisar cada etapa y mostrársela a Argemiro |
| **Producción** | Vercel + Railway, en doctraderpro.com y api.doctraderpro.com | Reales | Clientes |

- Cada entorno tiene sus propias llaves y secretos. Nunca se copian datos reales de producción a otro entorno.
- En desarrollo y pruebas, los pagos se verifican en las **redes de prueba** de Tron (Nile) y Bitcoin (testnet o
  signet), y Twilio usa números de prueba.

## 3. Pruebas automáticas

| Tipo | Qué cubre | Herramienta |
|---|---|---|
| **Reglas de negocio** | Fechas de licencia (meses de calendario, obsequio, completar la prueba, renovar en gracia), precios y diferencias, comisión, normalización de correo, teléfono y cuenta, huellas HMAC | Vitest en `packages/shared` |
| **API** | Permisos (un cliente no ve lo de otro; un cliente no entra a rutas de admin), registro e ingreso, pagos (hash repetido, aprobar dos veces al mismo tiempo, monto incompleto), control de la prueba, cifrado | Vitest + Supertest contra una base de datos de prueba (NestJS 12 trae Vitest) |
| **Verificadores de blockchain** | Respuestas grabadas de TronGrid y mempool.space (pago correcto, monto incompleto, otra dirección, sin confirmaciones, proveedor caído) | Vitest con respuestas grabadas |
| **De punta a punta** | Registro → agregar cuenta → orden → reportar hash → aprobar → por conectar → conectada; solicitud de prueba → aprobación → completarla; ticket de ida y vuelta | Playwright |
| **Accesibilidad y diseño** | Sin desbordes a 320, 390, 768, 1024 y 1440 px; foco visible; contraste | Playwright + axe |

**Integración continua** (GitHub Actions) en cada pull request: lint, revisión de tipos, pruebas, búsqueda de
secretos (gitleaks), análisis de código (CodeQL) y revisión de dependencias (Dependabot).

## 4. Etapas

Cada etapa deja algo que se puede usar y probar. El orden respeta las dependencias: no hay pagos sin cuentas, ni
prueba sin pagos.

### Etapa 0 — Base del proyecto ✅ (2026-10-14)
- Monorepo, Docker Compose de desarrollo, integración continua y despliegue a pruebas.
- Sistema de diseño de la propuesta 2 en Tailwind: colores, Inter, píldoras, triángulos y componentes base.
- Migraciones de TypeORM, datos iniciales (planes, ajustes, direcciones de depósito, los dos admins) y auditoría.
- **Hecho cuando:** la web y la API vacías se despliegan solas en pruebas y las pruebas corren en cada pull request.
- **Resultado:** monorepo con NestJS 12, Next.js 16, Tailwind 4 y TypeORM; Docker Compose; migración inicial (usuarios,
  socio, planes, ajustes, direcciones y auditoría encadenada que la base de datos no deja cambiar); semilla; worker con
  latido; `/salud`; sistema de diseño (`/sistema`) y página temporal; GitHub Actions, CodeQL, gitleaks y Dependabot.
  28 pruebas unitarias y 14 de punta a punta. **Desplegado** (2026-10-14): web en Vercel, API y worker en Railway, cada
  uno se actualiza solo al fusionar en `main` (direcciones en el `README.md`).

### Etapa 1 — Cuentas y acceso ✅ (2026-10-14)
- Registro con nombre, cédula, correo y teléfono, casillas de términos, datos y riesgo, y Turnstile.
- Verificación del correo, ingreso, recuperar contraseña, sesiones en Redis y aviso de dispositivo nuevo.
- Segundo factor obligatorio para admins y confirmación reciente para acciones delicadas.
- Roles, límites de velocidad, encabezados de seguridad.
- **Hecho cuando:** un cliente se registra y entra; un admin entra con segundo factor; las pruebas de permisos pasan.
- **Resultado:**
  - **API:** registro (cédula cifrada, autorizaciones con versión, IP y navegador), verificación del correo, ingreso
    con espera creciente desde 5 fallos y Turnstile y aviso al dueño desde 10, sesiones en Redis con duración por rol,
    segundo factor con app (QR, código que no se repite, 10 códigos de recuperación), confirmación reciente,
    recuperar contraseña, lista de sesiones para cerrarlas, aviso de navegador nuevo, roles y límites de velocidad.
    Solo atiende a la web (secreto compartido); el resto responde 404.
  - **Correos:** bandeja de salida en la base de datos y el worker los envía (Resend, Mailpit o consola), con
    reintentos y sin dejar los enlaces guardados después de enviarlos.
  - **Web:** registro, ingreso en dos pasos, confirmar correo, recuperar y restablecer contraseña, configurar el
    segundo factor, panel del cliente y del admin (provisionales, con la sección de seguridad), textos legales y
    política de contenido (CSP).
  - 46 pruebas de punta a punta de la API y recorrido completo en el navegador (escritorio y celular).
  - **Falta para usarla con clientes reales:** Resend verificado (sin él no salen los correos) y Turnstile
    (`docs/PENDIENTES.md`).

### Etapa 2 — Página pública ✅ (2026-10-15)
- Landing de la propuesta 2 con planes y precios desde la base de datos, preguntas frecuentes, Myfxbook y broker.
- Páginas legales desde `legal_documents` (textos de `docs/legal/`).
- **Hecho cuando:** la landing se ve como el prototipo, carga rápido en celular y los textos legales se pueden
  actualizar sin tocar código.
- **Resultado:**
  - **Landing** igual al prototipo (logo de partículas, problema, cuatro pasos, resultados de Myfxbook, precios,
    preguntas y cierre). Planes, precios, preguntas, cifras y enlaces salen de la base de datos y quedan en caché;
    si la API no responde, se muestran los datos de la semilla.
  - **Textos legales** en `legal_documents`, con versiones que la base de datos no deja cambiar ni borrar. Cada
    autorización del registro apunta a la versión exacta aceptada.
  - **Panel de admin:** pestañas "Preguntas" (agregar, quitar, ordenar y guardar) y "Textos legales" (editar en
    Markdown y publicar una versión nueva con el código de la app). La landing y las páginas legales se
    actualizan al guardar.
  - `robots.txt` y `sitemap.xml`.
  - **Queda para después:** pedir que los clientes acepten de nuevo cuando cambie un texto legal (etapa 8, con
    los correos), y editar precios y cifras de Myfxbook desde el panel (etapa 5, ajustes).

### Etapa 3 — Cuentas de trading, licencias y órdenes ✅ (2026-10-15)
- Agregar cuentas con contraseñas cifradas y la regla de una cuenta por cliente.
- Crear órdenes de compra, renovación y cambio de plan, con precio de BTC fijo por una hora y cuenta regresiva.
- Panel del cliente: mis cuentas con el calendario de triángulos, pagos e historial.
- **Hecho cuando:** un cliente crea una orden, ve la dirección y el monto exactos, y la orden expira sola a la hora.
- **Resultado:**
  - **Tablas:** `trading_accounts`, `licenses`, `license_periods` y `payment_orders` (número `DTP-000001`). La base
    de datos impide una cuenta de trading en dos clientes, más de una orden abierta por licencia y un hash repetido
    en la misma red.
  - **Cuentas:** agregar (contraseñas cifradas, cada cuenta nace con su licencia por pagar), editar (si estaba
    conectada vuelve a "por conectar" y se avisa por correo; en prueba no se cambian broker, servidor ni número) y
    quitar (solo sin licencia en curso ni conexión; las contraseñas se borran).
  - **Órdenes:** el tipo sale del estado de la licencia (nueva, renovación o cambio de plan); copian el precio del
    plan y la dirección activa y valen una hora. En BTC el precio se fija con Binance y se compara con CoinGecko
    (si difieren más de 1 %, no se crea la orden y se avisa a los admins). Una orden nueva reemplaza a la pendiente;
    una con el pago reportado no. El cliente reporta el hash; el worker marca expiradas las órdenes cada minuto.
  - **Panel del cliente:** "Mis cuentas" (titular con lo más urgente, calendario de triángulos, panel lateral para
    agregar y editar), "Pagos" (cuenta regresiva, USDT o BTC, monto y dirección para copiar, reportar el hash,
    confirmaciones en triángulos e historial) y "Perfil" (datos con la cédula enmascarada y la seguridad).
  - 45 pruebas de `shared`, 34 unitarias de la API y 75 de punta a punta; recorrido en el navegador (registro,
    cuenta, orden en USDT, cambio a BTC con el precio real, reporte del hash) sin desbordes a 320, 390 y 1440 px.
  - **Queda para la etapa 4:** verificar el hash en la blockchain y aprobar o rechazar el pago (hasta entonces, una
    orden reportada espera). La prueba de 15 días y completarla llegan en la etapa 6.

### Etapa 4 — Verificación y aprobación de pagos ✅ (2026-10-15)
- Worker con BullMQ: verificadores de Tron y Bitcoin con proveedor de respaldo, confirmaciones y reintentos.
- Vista de pagos del admin con los cinco chequeos, aprobar, rechazar con motivo y aprobación automática (apagada).
- Al aprobar: periodo, licencia activa, comisión del socio y cuenta "por conectar".
- **Hecho cuando:** un pago real en la red de prueba se verifica solo y, al aprobarlo, la licencia queda activa con
  las fechas correctas.
- **Resultado:**
  - **Verificación:** TronGrid y Tronscan (USDT en Tron), mempool.space y Blockstream (Bitcoin). Si el principal
    falla se usa el de respaldo; si fallan los dos, el pago queda "sin respuesta de la blockchain" y se reintenta.
    El worker revisa los pagos reportados cada 30 segundos y guarda los cinco chequeos (hash sin usar, destino y
    moneda, monto, fecha posterior a la orden y confirmaciones), lo recibido, la billetera de origen y el bloque.
    Una transacción que no aparece en 6 horas queda "no coincide".
  - **Panel de admin, pestaña "Pagos":** pagos por revisar con los chequeos en triángulos, "Aprobar pago" (solo
    verificados), "Aprobar de todos modos" (los demás, con confirmación), "Rechazar" con motivo (le llega al
    cliente por correo), "Verificar de nuevo", el interruptor de aprobación automática (encenderla pide el código
    de la app), los revisados de la semana y las órdenes expiradas. "Hoy" muestra cuántos pagos esperan.
  - **Al aprobar,** en una transacción: periodo nuevo, licencia activa con sus fechas (las renovaciones y cambios
    de plan suman al vencimiento, también en la gracia), % y comisión del socio copiados en la orden, la cuenta pasa
    a "por conectar" (o sigue conectada si estaba por desconectar), correo al cliente y auditoría.
  - **Estados de licencia** (cada 5 minutos): activa → en gracia → vencida; al vencer, la cuenta conectada pasa a
    "por desconectar".
  - Probado con transacciones reales de USDT de la dirección de cobro (TronGrid y Tronscan dan lo mismo) y
    respuestas grabadas de los cuatro proveedores. 84 pruebas de punta a punta y recorrido en el navegador (reportar,
    verificar en la blockchain real, rechazar, aprobar de todos modos y ver la licencia activa).
  - **Falta:** un pago real de punta a punta en producción (ver `PENDIENTES.md`). La red de prueba de Tron (Nile)
    usa otro contrato de USDT, así que la prueba útil es un pago real pequeño a la dirección de producción.

### Etapa 5 — Operación del admin ✅ (2026-10-15)
- Hoy, listas por conectar y por desconectar, ver contraseñas con segundo factor, ficha del cliente (capital, riesgo,
  notas, extender días, suspender).
- Licencias con filtros y exportar a CSV; ajustes (precios, gracia, confirmaciones, enlaces, cifras de Myfxbook,
  preguntas frecuentes); direcciones de depósito con la espera de 24 horas.
- **Hecho cuando:** Argemiro puede operar un día completo desde el panel sin ayuda.
- **Resultado:**
  - **Pestañas del admin:** Hoy, Pagos, Cuentas, Licencias y Ajustes (las preguntas frecuentes y los textos legales
    quedan dentro de Ajustes).
  - **Hoy:** lo pendiente (pagos por revisar, cuentas por conectar y por desconectar, licencias que vencen en 7
    días), las ventas del mes con la gráfica de triángulos por día y plan (y su tabla), hoy, el mes anterior y el
    año, por moneda, cuentas conectadas, nuevas y renovaciones del mes, y la actividad reciente sacada de la
    auditoría. Se actualiza cada minuto.
  - **Cuentas:** por conectar con los datos para Social Trader Tools y botones de copiar; "Ver contraseñas" pide el
    código de la app si la confirmación de 5 minutos venció, queda en la auditoría y las oculta a los 60 segundos;
    capital recomendado y nivel de riesgo (los ve el cliente); "Marcar como conectada" (correo al cliente). Las que
    esperan la aprobación del pago aparecen aparte. Por desconectar: gracia terminada o suspendida, con "Marcar como
    desconectada". Una cuenta que ya estuvo conectada y vuelve (cambió sus datos) se marca distinto.
  - **Licencias:** filtros con conteos (todas, activas, vence en 7 días, en gracia, vencidas, pendientes, en prueba,
    suspendidas), búsqueda por nombre, correo o cuenta, y exportar a CSV (pide el código; nunca lleva contraseñas
    ni cédulas; queda en la auditoría). La ficha (panel lateral) trae contacto con la cédula enmascarada ("Ver
    completa" queda en la auditoría), la cuenta, capital, riesgo y notas internas, extender días con motivo (correo
    al cliente), periodos, pagos, otras cuentas del cliente y suspender (segundo clic) o quitar la suspensión.
  - **Ajustes:** precios (la prueba debe costar menos que el mensual) y duración de la prueba; días de gracia,
    vigencia de la orden y confirmaciones (ambos con el código de la app); la aprobación automática; direcciones de
    depósito; enlaces de la página y correo de soporte; cifras de Myfxbook. Los cambios de la página pública se ven
    al instante.
  - **Direcciones de depósito:** se validan con su checksum (Tron y Bitcoin: 1…, 3…, bc1q… y bc1p…); entran "en
    espera" 24 horas y les llega un correo a los dos admins con la dirección completa; cualquiera la cancela sin
    código (salida de emergencia); el worker las activa al cumplir las 24 horas; desactivar y reactivar piden el
    código. Las órdenes nuevas usan la activa más reciente de cada red.
  - 103 pruebas de punta a punta (19 nuevas) y recorrido en el navegador a 390 y 1440 px.

### Etapa 6 — Licencia de prueba ✅ (2026-10-15)
- Verificación del teléfono por SMS (Twilio Verify) con límites y protección contra fraude.
- Solicitud con bloqueos y señales, registro de huellas, aprobación del admin y orden de USD 50.
- Completar la prueba pagando la diferencia; bloqueo de cambios de la cuenta durante la prueba.
- **Hecho cuando:** las pruebas automáticas confirman que la misma cédula, cuenta, correo o teléfono no pueden pedir
  una segunda prueba, aunque se registren de nuevo.
- **Resultado:**
  - **Panel del cliente, "Prueba"** (`/panel/prueba`): tres pasos (correo, teléfono por SMS y cuenta de trading) y
    el estado de la solicitud (en revisión, aprobada con "Pagar la prueba", rechazada con el motivo o bloqueada
    con lo que coincidió). "Mis cuentas" invita a pedirla mientras el cliente no haya pedido ninguna, da prioridad
    a la prueba aprobada y, en prueba, muestra los días y "Completar" a cada plan con la diferencia y hasta cuándo
    queda.
  - **SMS:** Twilio Verify (genera, envía y valida el código; sin librería, por HTTP). Límites: 3 por teléfono por
    hora, 5 por día, 10 por IP por hora y 8 intentos de código cada 15 minutos; Turnstile antes de cada envío. En
    desarrollo el código se escribe en el registro de la API; en producción, sin Twilio, la prueba queda cerrada.
  - **Bloqueos:** cédula, cuenta (broker + servidor + número normalizados), correo (canónico) y teléfono que ya
    tuvieron prueba, comparados con huellas HMAC (`TRIAL_HMAC_KEY`) que sobreviven al borrado del cliente. La
    solicitud bloqueada se guarda para el admin y el cliente ve el motivo.
  - **Señales** (no bloquean): número de cuenta usado en otro broker, mismo dispositivo, misma IP, titular
    parecido, número de cuenta parecido, rechazos o bloqueos anteriores del mismo cliente; y, al revisar el pago,
    billetera de origen que ya pagó otra prueba.
  - **Admin, Pagos → "Solicitudes de prueba":** cada solicitud con sus señales; sin señales, "Aprobar prueba"; con
    señales, "Rechazar" (motivo por correo) primero y "Aprobar de todos modos". Las bloqueadas de 30 días. "Hoy"
    cuenta las pruebas por aprobar. Correo a los admins con cada solicitud.
  - **Al aprobar la solicitud:** las huellas entran al registro y el cliente recibe un correo para pagar. **Al
    aprobar el pago de USD 50:** la licencia queda "en prueba" por 15 días sin gracia, la cuenta por conectar y
    bloqueada (sin cambiar broker, servidor ni número). **Completar:** paga la diferencia (USD 70 o 449) y el plan
    cuenta desde el inicio de la prueba. Al terminar los 15 días sin completarla, vence y pasa a por desconectar.
  - 109 pruebas de punta a punta (6 nuevas: el recorrido completo, los bloqueos aunque se registren de nuevo con
    los mismos datos, las señales, el rechazo, el límite de SMS y el vencimiento) y recorrido en el navegador.
  - **Falta:** crear la cuenta de Twilio y probar un SMS real (ver `PENDIENTES.md`). La foto de la cédula
    (opcional, apagada) llega con los archivos de la etapa 7.

### Etapa 7 — Soporte ✅ (2026-10-15)
- Tickets del cliente con adjuntos en R2, bandeja del admin con filtros, asignación, prioridad, notas internas y
  respuestas guardadas; cierre automático.
- **Hecho cuando:** un ticket va y vuelve entre cliente y admin con adjuntos y correos.
- **Resultado:**
  - **Panel del cliente, "Soporte"** (`/panel/soporte`): el titular dice si hay respuesta nueva ("Respondimos tu
    ticket.") y la pestaña lleva un punto naranja. Lista de tickets con estado, asunto, tema y fecha; panel lateral
    con el hilo, la respuesta con adjuntos y "Mi problema ya se resolvió". En uno resuelto, escribir lo abre de
    nuevo; uno cerrado ya no recibe mensajes. Abrir un ticket: tema, cuenta u orden relacionada, asunto, mensaje y
    adjuntos (`?nuevo=1&tema=…&cuenta=…` lo abre desde otras vistas). El equipo firma siempre "DocTrader Pro".
  - **Admin, "Soporte"** (`/admin/soporte`): cuántos esperan respuesta, cuánto lleva el más antiguo y el promedio de
    la primera respuesta de la semana; filtros (sin responder, abiertos, resueltos, todos) y por tema; cada ticket
    con su espera (en naranja pasadas 4 horas) y a quién está asignado. Panel lateral con el cliente, la cuenta u
    orden, asignación y prioridad (se guardan al elegir), el hilo con las **notas internas** en verde limón,
    respuestas guardadas (se agregan al texto) y "Marcar como resuelto". La pestaña y "Hoy" cuentan los sin
    responder. **Respuestas guardadas** en `/admin/respuestas` (4 iniciales) y, en Ajustes, los días de cierre.
  - **Correos:** a los admins con cada ticket nuevo o reabierto; al cliente con cada respuesta (con el texto) y al
    resolverlo (con la fecha de cierre). Las notas internas no envían nada.
  - **Adjuntos:** imágenes (JPG, PNG, WEBP) o PDF, hasta 5 por mensaje y 10 MB cada uno. El navegador los sube
    **directo a la API** con una ficha firmada de 30 minutos (las funciones de Vercel no aceptan más de 4,5 MB);
    la API revisa el tipo por el contenido, vuelve a codificar las imágenes (sin metadatos ni ubicación) y los
    guarda con nombre aleatorio en R2. La descarga pasa por la web, que revisa el permiso y redirige a un enlace
    firmado de 5 minutos, siempre como descarga. Sin R2 en producción, los tickets funcionan solo con texto.
  - **Worker:** cada hora cierra los resueltos que pasaron sus días (7, editable) y borra los adjuntos que nadie
    usó en 24 horas.
  - 113 pruebas de punta a punta (4 nuevas: el ticket de ida y vuelta con adjuntos, notas y correos; los adjuntos
    falsos, rotos, grandes o con metadatos; los permisos entre clientes; asignar, prioridad, respuestas y ajustes) y
    recorrido en el navegador a 1440 y 390 px.
  - **Falta:** crear el depósito de R2 y sus llaves, y probar un adjunto real en producción (ver `PENDIENTES.md`).
    Revisión antivirus de los PDF: pendiente (`SEGURIDAD.md` §7). La foto de la cédula sigue apagada.

### Etapa 8 — Automatizaciones y socio
- Correos con Resend (plantillas con la marca), recordatorios, gracia, vencimiento y alertas a los admins.
- Perfil del socio: % de comisión, liquidaciones del 15 y fin de mes e historial.
- Trabajos de borrado según la política de datos.
- **Hecho cuando:** una licencia de prueba recorre todo su ciclo en pruebas (con fechas aceleradas) y llegan todos
  los correos, una sola vez cada uno.

### Etapa 9 — Endurecimiento y lanzamiento
- Revisión de seguridad completa contra `SEGURIDAD.md`, Sentry, monitor de disponibilidad, copias de seguridad y una
  restauración de prueba.
- Dominio y correo: DNS en Hostinger, Resend verificado, DMARC.
- Lista de lanzamiento (§5) y lanzamiento suave con pocos clientes antes de anunciarlo.

## 5. Lista para el día del lanzamiento

**Legal y contenido**
- [ ] Datos del responsable completos en la política de datos (NIT o cédula, dirección y teléfono).
- [ ] Términos, política y aviso de riesgo publicados (idealmente revisados por un abogado).
- [ ] Cifras de Myfxbook al día; caída máxima y tiempo auditado solo si el historial ya está completo.

**Dinero**
- [ ] Direcciones de USDT (Tron) y BTC comprobadas con un pago real pequeño a cada una, verificado por la plataforma.
- [ ] Cuenta de Binance con segundo factor fuerte, código antiphishing y lista blanca de retiros.
- [ ] Precios, días de gracia y confirmaciones revisados en el panel.

**Cuentas y seguridad**
- [ ] Los dos admins entran con segundo factor y guardaron sus códigos de recuperación.
- [ ] Segundo factor en Vercel, Railway, Resend, Twilio, Cloudflare, Sentry, GitHub y Hostinger.
- [ ] Llaves de cifrado de producción guardadas en el gestor de contraseñas compartido.
- [ ] Copia de seguridad restaurada con éxito al menos una vez.
- [ ] Permisos geográficos de Twilio solo para los países donde se vende.

**Funcionamiento**
- [ ] Recorrido completo con una cuenta real: registro → compra → pago → aprobación → conexión → correo.
- [ ] Correos llegando a la bandeja de entrada (no a spam) en Gmail y Outlook.
- [ ] Monitor de disponibilidad y alertas activos.
- [ ] Revisión en celular (iPhone y Android) y en escritorio.

## 6. Después del lanzamiento

- Binance Pay Merchant cuando Binance lo apruebe.
- Segunda verificación con el historial de depósitos de Binance (llave solo de lectura).
- Fase 2 (`CONTEXTO.md` §7): pagos en pesos, referidos, cupones, avisos por Telegram o WhatsApp y versión en inglés.
