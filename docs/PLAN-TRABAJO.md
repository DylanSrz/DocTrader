# Plan de trabajo

> 2026-10-14. Cómo se construye la fase 1 (lanzamiento). Alcance en `CONTEXTO.md` §7; datos y estados en
> `MODELO-DATOS.md`; seguridad en `SEGURIDAD.md`; servicios en `DECISIONES-TECNICAS.md`. Diseño de referencia:
> `design/propuesta-2/` (landing, panel del cliente y panel de admin).

## 1. Cómo se trabaja

- **Repositorio:** monorepo pnpm con `apps/api` (NestJS: API y worker), `apps/web` (Next.js) y `packages/shared`
  (tipos, esquemas de validación y reglas de negocio puras, como el cálculo de fechas y precios).
- **Ramas:** `main` es producción (Vercel y Railway despliegan desde ahí). Desde el 2026-10-22 se desarrolla sobre
  **`dev`**: los cambios entran a `dev` por pull request con las pruebas en verde, se prueban en la vista previa de
  Vercel de `dev` y, si todo está bien, se abre un pull request de `dev` a `main` para publicarlos.
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
  signet).

## 3. Pruebas automáticas

| Tipo | Qué cubre | Herramienta |
|---|---|---|
| **Reglas de negocio** | Fechas de licencia (meses de calendario, obsequio, renovar en gracia), precios, comisión, normalización de correo, teléfono y cuenta, huellas HMAC | Vitest en `packages/shared` |
| **API** | Permisos (un cliente no ve lo de otro; un cliente no entra a rutas de admin), registro e ingreso, pagos (hash repetido, aprobar dos veces al mismo tiempo, monto incompleto), cifrado | Vitest + Supertest contra una base de datos de prueba (NestJS 12 trae Vitest) |
| **Verificadores de blockchain** | Respuestas grabadas de TronGrid y mempool.space (pago correcto, monto incompleto, otra dirección, sin confirmaciones, proveedor caído) | Vitest con respuestas grabadas |
| **De punta a punta** | Registro → agregar cuenta → orden → reportar hash → aprobar → por conectar → conectada; ticket de ida y vuelta | Playwright |
| **Accesibilidad y diseño** | Sin desbordes a 320, 390, 768, 1024 y 1440 px; foco visible; contraste | Playwright + axe |

**Integración continua** (GitHub Actions) en cada pull request: lint, revisión de tipos, pruebas, búsqueda de
secretos (gitleaks), análisis de código (CodeQL) y revisión de dependencias (Dependabot).

## 4. Etapas

Cada etapa deja algo que se puede usar y probar. El orden respeta las dependencias: no hay pagos sin cuentas.

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
    conectada vuelve a "por conectar" y se avisa por correo) y quitar (solo sin licencia en curso ni conexión; las
    contraseñas se borran).
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
    orden reportada espera). La prueba de 15 días llegó en la etapa 6 y se retiró el 2026-10-15.

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
  - **Licencias:** filtros con conteos (todas, activas, vence en 7 días, en gracia, vencidas, pendientes y
    suspendidas), búsqueda por nombre, correo o cuenta, y exportar a CSV (pide el código; nunca lleva contraseñas
    ni cédulas; queda en la auditoría). La ficha (panel lateral) trae contacto con la cédula enmascarada ("Ver
    completa" queda en la auditoría), la cuenta, capital, riesgo y notas internas, extender días con motivo (correo
    al cliente), periodos, pagos, otras cuentas del cliente y suspender (segundo clic) o quitar la suspensión.
  - **Ajustes:** precios; días de gracia, vigencia de la orden y confirmaciones (ambos con el código de la app); la
    aprobación automática; direcciones de depósito; enlaces de la página y correo de soporte; cifras de Myfxbook.
    Los cambios de la página pública se ven al instante.
  - **Direcciones de depósito:** se validan con su checksum (Tron y Bitcoin: 1…, 3…, bc1q… y bc1p…); entran "en
    espera" 24 horas y les llega un correo a los dos admins con la dirección completa; cualquiera la cancela sin
    código (salida de emergencia); el worker las activa al cumplir las 24 horas; desactivar y reactivar piden el
    código. Las órdenes nuevas usan la activa más reciente de cada red.
  - 103 pruebas de punta a punta (19 nuevas) y recorrido en el navegador a 390 y 1440 px.

### Etapa 6 — Licencia de prueba ✅ (2026-10-15) — retirada el 2026-10-15
- Se construyó y se quitó el mismo día, por decisión del cliente: prueba de 15 días por USD 50 solo con solicitud
  aprobada por el admin, verificación del teléfono por SMS (Twilio Verify), control antiabuso con huellas HMAC
  (`TRIAL_HMAC_KEY`) que sobrevivían al borrado del cliente, bloqueo de la cuenta durante la prueba y completarla
  pagando la diferencia. Nunca se pudo pedir en producción (no hubo Twilio).
- **Retiro:** la migración `1792800000000-quitar-prueba` borra sus tablas, el plan, los estados, los tipos de orden
  y de periodo, las columnas y los ajustes (detalle en `MODELO-DATOS.md` §3.5) y publica los términos y la política
  de datos sin la prueba. Para conocer el software, el cliente empieza con el mensual y puede pasar al semestral
  antes de que venza.

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
    Revisión antivirus de los PDF: pendiente (`SEGURIDAD.md` §7).

### Etapa 8 — Automatizaciones y socio ✅ (2026-10-15)
- Correos con Resend (plantillas con la marca), recordatorios, gracia, vencimiento y alertas a los admins.
- Perfil del socio: % de comisión, liquidaciones del 15 y fin de mes e historial.
- Trabajos de borrado según la política de datos.
- **Hecho cuando:** una licencia mensual recorre todo su ciclo en pruebas (con fechas aceleradas: recordatorios,
  gracia, vencimiento y renovación) y llegan todos los correos, una sola vez cada uno.
- **Resultado:**
  - **Correos al cliente:** bienvenida (al confirmar el correo, una vez), recordatorios 7, 3 y 1 día antes del
    vencimiento (solo el del tramo en que está la licencia, y ninguno si ya reportó el pago de la renovación),
    "tu licencia venció" el día del vencimiento con la fecha de fin de la gracia, y "desconectaremos la cuenta" al
    terminar la gracia. Cada correo lleva una clave con la fecha de vencimiento: no se repite aunque el trabajo
    corra muchas veces, y una renovación empieza un ciclo nuevo.
  - **Avisos a los admins:** pago verificado por aprobar (o con un problema para revisar a mano; no llega si la
    aprobación automática está encendida), venta aprobada (quién, plan, monto y si la cuenta quedó por conectar),
    cuenta por actualizar cuando un cliente cambia los datos de una cuenta conectada, cuenta por desconectar al
    terminar la gracia, cambio del porcentaje del socio y quincena liquidada. Se sumaron a los de tickets y
    direcciones de depósito.
  - **No se hizo** el correo de "orden creada": la orden vale una hora, el cliente la ve en pantalla y se reemplaza
    cada vez que cambia de plan o de moneda (serían correos de más).
  - **Socio** (`/admin/socio`): la comisión de la quincena en curso, el porcentaje (solo el socio lo cambia, con el
    código de la app; aplica a las ventas siguientes y avisa al otro admin), las liquidaciones con su estado y el
    historial de cambios. El worker cierra cada hora las quincenas terminadas (1 al 15 y 16 al último día, en hora
    de Colombia) con sus ventas y su comisión, y avisa a los admins; cualquiera de los dos la marca como pagada con
    la referencia del pago (también con el código).
  - **Borrado diario** (3 a. m. de Colombia): contraseñas de trading de cuentas sin licencia vigente desde hace 90
    días (o borradas), tickets cerrados hace más de 2 años (con sus adjuntos), y dispositivos, enlaces de un solo
    uso y correos enviados de más de 12 meses. Las órdenes, las autorizaciones y la auditoría no se tocan.
  - **Arreglo en los formularios con código:** cuando la API pedía el código de la app, el formulario volvía a los
    valores de antes y el segundo envío no cambiaba nada (precios, días de gracia, dirección nueva). Ahora conserva
    lo escrito.
  - 113 pruebas de punta a punta (6 nuevas: el ciclo completo de una licencia mensual con todos sus correos una
    vez, sin recordatorio con el pago en revisión, cuenta por actualizar, porcentaje del socio, liquidación y pago
    de quincenas, borrado de datos) y recorrido en el navegador de "Socio" a 1440 y 390 px.
  - **Queda para después:** eliminar desde el panel la cuenta de un cliente que lo pida (anonimizar sus datos y
    conservar órdenes y pagos). No hace falta pedir que acepten de nuevo los textos legales: los clientes de hoy son
    de prueba y la base de datos se limpia antes de salir (ver §5).

### Etapa 9 — Endurecimiento y lanzamiento
- Revisión de seguridad completa contra `SEGURIDAD.md`, Sentry, monitor de disponibilidad, copias de seguridad y una
  restauración de prueba.
- Dominio y correo: DNS en Hostinger, Resend verificado, DMARC.
- Lista de lanzamiento (§5) y lanzamiento suave con pocos clientes antes de anunciarlo.
- **Lo construido (2026-10-15):**
  - **Eliminar un cliente que lo pida**, desde su ficha en Licencias, con el código de la app: se anonimizan su nombre,
    cédula, correo y teléfono; se borran las contraseñas de sus cuentas, sus tickets, sesiones, dispositivos y correos;
    sus licencias terminan y una cuenta conectada queda por desconectar. Se conservan las órdenes y los pagos. El
    cliente recibe un correo y puede registrarse de nuevo; en su perfil hay una sección para pedirlo por ticket.
  - **Revisión de seguridad** contra `SEGURIDAD.md`, con estos arreglos:
    - **Pagos: monto único por orden.** Todas las órdenes usan la misma dirección y el mismo precio, así que un
      cliente podía reportar como suyo el hash del pago de otro. Ahora cada orden abierta tiene un monto distinto (de
      0,01 a 0,99 USDT, o de 1 a 999 satoshis, **menos** que el precio) y la verificación exige el monto exacto; uno
      mayor queda para revisar a mano.
    - Segundo factor: máximo 10 códigos por hora por usuario, contados de forma atómica entre todas sus sesiones.
    - Ingreso: la espera tras varios fallos es por correo e IP (nadie deja fuera al dueño desde otra IP).
    - Cambiar los enlaces públicos pide el código de la app; el nombre del registro solo admite letras.
    - El worker recalcula cada día la cadena de la auditoría y avisa si no cuadra.
  - **Monitoreo:** Sentry en la API, el worker y el servidor de la web, activo solo con `SENTRY_DSN` y sin datos
    personales. Alertas a los dos admins: pagos sin verificar después de una hora, más de 50 ingresos fallidos en una
    hora, trabajos del worker que fallan (una vez al día por trabajo) y la auditoría alterada.
  - **Copias de seguridad:** flujo diario que copia, restaura en un Postgres vacío, revisa, cifra y guarda en R2 30
    días (`.github/workflows/copia-de-seguridad.yml`), además de las copias de Railway.
  - **Limpieza para el lanzamiento:** `node apps/api/dist/database/limpiar.js` (README, "Limpieza antes del
    lanzamiento").
  - 119 pruebas de punta a punta (6 nuevas: eliminar un cliente, un hash ajeno no sirve, montos distintos, el límite
    de códigos en paralelo, el nombre del registro y las alertas).
- **Después (2026-10-16):**
  - **Operación lista:** Sentry (API, worker y web), monitor de disponibilidad (UptimeRobot), copia diaria cifrada en
    R2 con restauración de prueba, dominio propio (`www.doctraderpro.com` y `api.doctraderpro.com`) con DNS en
    Hostinger y DMARC en `none`, y el worker en Europa para leer Binance.
  - **Pagos de Binance sin hash:** el cliente reporta el número de la transferencia interna y se verifica con una
    llave de Binance solo de lectura (ya puesta); el admin también puede registrar un pago a mano.
  - **Cambio de cuenta por ticket**, **descargar mis datos** (perfil del cliente), **QR de la dirección** en la
    pantalla de pago y **"Mi panel"** en la landing con la sesión iniciada.
  - **Auditoría del 2026-10-18** (11 puntos): USDT con el precio exacto y pagos "por confirmar" cuando otro cliente
    pudo enviarlos; registro con país, tipo y número de documento (clientes de varios países); precios de los términos
    tomados de los planes (`{{precios}}`); menú de tres líneas en celular y tablet; correo de soporte siempre como
    enlace; listas desplegables legibles (las opciones de un grupo salían blanco sobre blanco); contraseña con
    confirmación y requisitos en vivo; Turnstile revisado (el error de `data:` es del iframe de Cloudflare) y con
    chequeo del dominio; "Comprar" desde la landing con sesión abre la compra en el panel; copiar y descargar con
    estados de procesando, listo y error.
  - **Falta:** la lista del §5 y el lanzamiento suave.

### Etapa 10 — Presentación de ventas ✅ (2026-10-22)
- **`/presentacion`**: diapositivas a pantalla completa para las reuniones con clientes (portada, problema, qué es,
  cómo funciona, resultados, seguridad, con qué funciona, planes y cierre con QR al registro). Precios, planes y
  cifras de Myfxbook en vivo, los mismos de la landing (`obtenerLanding`, `lib/planes.ts`).
- Flechas, espacio, Inicio y Fin; deslizar en tablet; **N** muestra las notas para quien presenta; **F**, pantalla
  completa; `#3` abre la diapositiva 3. "Guardar PDF" imprime todas en 16:9, una por página.
- No se indexa ni está en el sitemap. Mismas reglas que la web: licencia de software, sin promesas de ganancia.
- La diapositiva 9, "Gana con referidos", llegó con la etapa 11; con `?ref=CODIGO`, el QR del cierre lleva a
  `/r/CODIGO`.
- **Rehecha el 2026-10-22 con la secuencia de Argemiro (17 diapositivas):**
  - **Primero el trading:** antes de empezar (aviso de riesgo), un gráfico de TradingView en vivo (XAU/USD), cómo se
    opera, qué necesitas (broker regulado; mercado de divisas según el BIS), por qué operar a mano hace perder (cifra
    de la ESMA) y por qué la tecnología gana.
  - **Después el sistema:** qué es DocTrader Pro IA, nuestro sistema, por qué automático con IA, rendimientos
    (Myfxbook), seguridad, el objetivo (retiro y patrimonio con interés compuesto), planes, la calculadora, referidos
    (tabla por plan y línea con el esquema "TÚ") y cierre.
  - **Calculadora de interés compuesto** (aprobada el 2026-10-22): la rentabilidad mensual la escribe quien presenta
    (nunca hay una por defecto) y lleva el aviso de que es un ejemplo ilustrativo; no aparece en la landing. El
    cálculo está en `packages/shared/src/interes.ts`, con pruebas.
  - En el PDF, el gráfico en vivo se cambia por velas dibujadas y la calculadora indica que funciona en vivo.

### Etapa 11 — Programa de referidos ✅ (2026-10-22)
- Argemiro aprobó las siete decisiones el 2026-10-22: 20 % de cada compra del referido mientras sea cliente, pago en
  USDT (Tron) cada quincena desde USD 20, sin comisión mientras la licencia del referidor esté vencida, cookie de 30
  días (gana el último enlace), sin beneficio para el invitado y el socio sigue al 10 % sobre el bruto.
- Refieren los clientes con licencia activa o en gracia, quienes un admin habilite y el socio con su cuenta de admin.
- **PR #43 (API):** tablas, atribución en el registro, comisión al aprobar, liquidación cada hora con espera de 48 h
  tras cambiar la dirección, correos, auditoría, "mis datos" y eliminación.
- **PR #44 (web):** `/r/CODIGO`, "Te invitó" en el registro, `/panel/referidos`, `/admin/referidos`, ficha del
  cliente, sección del socio, línea en la landing y diapositiva 9.
- **Parte 3:** sección 16 "Programa de referidos" en los términos y los datos del programa en la política de datos,
  publicados como versiones nuevas por migración; documentación.
- **Ajuste del 2026-10-22 (pedido de Argemiro, con los términos ya revisados por su abogado):** 15 % por la primera
  línea y 5 % por la segunda (los referidos de los referidos), con las mismas reglas para cobrar; si el intermedio
  vence o se va, el de arriba sigue cobrando. Cada quien ve su red hasta la segunda línea. Tabla
  `referral_commissions`, nueva versión del 16.2 de los términos y de la política de datos (sin correo masivo: los
  clientes actuales son de prueba), ajustes con los dos porcentajes, landing y diapositiva 9.

## 5. Lista para el día del lanzamiento

**Legal y contenido**
- [x] Datos del responsable completos en la política de datos y en los términos (NIT, dirección y teléfono): se
      publican con la migración `1793500000000-datos-responsable` (2026-10-23).
- [x] Términos, política y aviso de riesgo publicados y revisados por el abogado (2026-10-22).
- [x] Cifras de Myfxbook al día (2026-10-23): cuenta 11792099 del otro broker, con ganancia y tiempo auditado; sin
      caída máxima, por decisión.

**Dinero**
- [x] Direcciones de USDT (Tron) y BTC comprobadas con un pago real pequeño a cada una, verificado por la plataforma (2026-10-22).
- [x] Cuenta de Binance con segundo factor fuerte, código antiphishing y lista blanca de retiros (2026-10-23).
- [x] Precios, días de gracia y confirmaciones revisados en el panel (2026-10-23).

**Cuentas y seguridad**
- [x] Los dos admins entran con segundo factor y guardaron sus códigos de recuperación (2026-10-23).
- [x] Segundo factor en Vercel, Railway, Resend, Cloudflare, Sentry, GitHub y Hostinger (2026-10-16).
- [ ] **Rotar todas las credenciales** por el incidente de seguridad de Railway del 2026-10-21, antes de anunciar
      (`docs/ROTACION-CREDENCIALES.md`): servicios externos, Postgres, Redis y las llaves de la aplicación.
      **Quién:** Dylan en los paneles; el desarrollo despliega y comprueba.
- [ ] Llaves de cifrado de producción guardadas en el gestor de contraseñas compartido (las nuevas, después de rotar).
      **Quién:** Dylan.
- [x] Copia de seguridad restaurada con éxito al menos una vez (2026-10-16; el flujo diario la restaura y la revisa solo).

**Funcionamiento**
- [x] Base de datos limpia (2026-10-23, `limpiar.js` con copia de seguridad antes): se borraron 10 clientes de prueba
      con 9 cuentas, 9 licencias, 20 órdenes, 7 tickets, 4 adjuntos y 100 correos; quedan 3 admins, los ajustes y los
      textos legales. Falta vaciar el depósito de adjuntos en Cloudflare R2 (**Quién:** Dylan) y revisar quién es el
      tercer admin.
- [x] Recorrido completo con una cuenta real: registro → compra → pago → aprobación → conexión → correo (2026-10-22).
- [x] Correos llegando a la bandeja de entrada (no a spam) en Gmail y Outlook (2026-10-22).
- [x] Monitor de disponibilidad y alertas activos (2026-10-16), con las direcciones del dominio propio
      (`https://api.doctraderpro.com/salud` y `https://www.doctraderpro.com`, 2026-10-23).
- [x] Revisión en celular (iPhone y Android) y en escritorio (2026-10-23).

**Recomendado antes de anunciar (no bloquea)**
- [x] Pruebas a mano: agregar y cancelar una dirección de depósito, un ticket de ida y vuelta y registrar a mano el
      pago DTP-000001 (2026-10-23).
- [x] Decisiones de Argemiro (2026-10-23): si falta un país o un documento, se escribe a soporte; sí se puede renovar
      a un plan más corto.
- [x] Mensaje a Myfxbook sobre el historial de la cuenta de JustMarkets (2026-10-23).

## 6. Después del lanzamiento

- Binance Pay Merchant cuando Binance lo apruebe.
- DMARC a `quarantine` después de dos semanas de correos sin problemas.
- Base de datos con un usuario de permisos separados para la aplicación.
- Llave de CoinGecko para la cotización de BTC (opcional).
- Fotos y videos para la landing.
- Fase 2 (`CONTEXTO.md` §7): pagos en pesos, cupones, avisos por Telegram o WhatsApp y versión en inglés (los
  referidos ya se hicieron en la etapa 11).
