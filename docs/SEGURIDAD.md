# Seguridad e integridad de la plataforma

> 2026-10-14. Plan de seguridad para construir la plataforma. Cada punto es un requisito de desarrollo, salvo los
> marcados como **operación** (cuentas y procesos de Argemiro y Dylan).

## 1. Qué protegemos y de qué

| Activo | Riesgo principal | Defensa clave |
|---|---|---|
| **Direcciones de depósito** | Que alguien las cambie y los pagos lleguen a otra billetera | Cambio con segundo factor, aviso a los dos admins y 24 horas de espera (§5) |
| **Contraseñas de las cuentas de trading** | Robo de la base de datos o de un admin | Cifrado por campo, vista solo con segundo factor y auditoría (§4) |
| **Aprobación de pagos** | Pagos falsos o un mismo hash usado dos veces | Verificación en blockchain del lado del servidor, hash único (§6) |
| **Cuentas de admin** | Robo de contraseña o phishing | Segundo factor obligatorio, sesiones cortas, avisos de ingreso (§3) |
| **Datos personales** (cédula, teléfono) | Filtración | Cifrado, mínimo acceso, plazos de borrado (§4, §8) |
| **Dominio y correo** | Suplantación (phishing con el nombre de la marca) | SPF, DKIM, DMARC, bloqueo del dominio (§10) |

La plataforma **nunca guarda llaves privadas de billeteras**: solo direcciones públicas. Aunque alguien tomara el
control total del servidor, no podría mover el dinero de Argemiro.

## 2. Ingreso y contraseñas

- Contraseñas guardadas con **Argon2id** (nunca en texto ni con cifrado reversible).
- De **10 a 128 caracteres**, con al menos **una mayúscula, una minúscula, un número y un carácter especial** (decisión
  del 2026-10-18; `problemaContrasena` en `@doctrader/shared`, que exigen la web y la API al registrarse y al
  restablecer; las contraseñas de antes siguen sirviendo para ingresar). Se rechazan las contraseñas filtradas consultando
  Have I Been Pwned por rango (k-anonimato: la contraseña nunca sale del servidor).
- **Límite de intentos** por IP y por cuenta: después de 5 fallos, espera creciente; después de 10, se pide el
  desafío de Cloudflare Turnstile y se avisa por correo al dueño de la cuenta.
- Mensajes de error genéricos ("correo o contraseña incorrectos"), para no revelar qué correos están registrados.
- **Recuperar contraseña:** enlace de un solo uso, válido 30 minutos, guardado como hash. Al cambiarla se cierran
  todas las sesiones.
- **Verificación del correo** al registrarse. El teléfono no se verifica por SMS desde el 2026-10-15 (se quitó la
  licencia de prueba, que era lo único que lo exigía).

## 3. Sesiones, segundo factor y permisos

- **Sesiones en el servidor**, no tokens JWT de larga vida: cookie `HttpOnly`, `Secure`, `SameSite=Lax`, con
  identificador aleatorio guardado en Redis. Así una sesión se puede cerrar al instante.
  - Admins: 30 minutos de inactividad y 8 horas como máximo.
  - Clientes: 7 días de inactividad y 30 días como máximo.
  - Cada usuario ve sus sesiones abiertas (dispositivo, lugar aproximado, fecha) y puede cerrarlas.
- **Segundo factor (TOTP con app de autenticación) obligatorio para los dos admins**, con 10 códigos de recuperación.
  Opcional y recomendado para los clientes.
- **Confirmación reciente con segundo factor** (vale 5 minutos) para las acciones delicadas:
  - ver las contraseñas de una cuenta de trading;
  - agregar, cambiar o desactivar direcciones de depósito;
  - cambiar precios, días de gracia o el % de comisión;
  - encender la aprobación automática de pagos;
  - exportar datos o la auditoría;
  - cambiar el correo, la contraseña o el segundo factor de la propia cuenta.
- **Permisos:** roles ADMIN y CLIENT con guardas en cada ruta de la API. Además del rol, cada consulta de un cliente
  se filtra por su propio id, para que nadie vea datos de otro cambiando un número en la URL. Los ids son UUID.
- **Avisos por correo** al usuario cuando: ingresa desde un dispositivo nuevo, cambia la contraseña, el correo o el
  segundo factor, o cambian los datos de su cuenta de trading.
- **CSRF:** además de `SameSite`, la API rechaza peticiones que cambian datos si el encabezado `Origin` no es
  `https://www.doctraderpro.com`.
- **Cómo quedó construido (etapa 1):**
  - El navegador nunca habla con la API. La cookie de sesión (`__Host-sesion`, `HttpOnly`, `Secure`,
    `SameSite=Lax`) es del dominio de la web; su servidor llama a la API con el token en `Authorization` y firma
    cada petición con `PROXY_SECRET`. Sin ese secreto la API responde 404 (salvo `/salud`). Así la API no es
    alcanzable desde afuera y las cookies no son de terceros.
  - El CSRF lo cubre Next.js: sus acciones del servidor solo aceptan peticiones cuyo `Origin` coincide con el sitio.
  - Redis guarda la huella (HMAC) del token, no el token. Al pasar el segundo factor o activarlo, la sesión cambia
    de token.
  - Un código de la app no se acepta dos veces; después de 5 códigos equivocados se cierra la sesión a medias.
  - Etapa 9: además, máximo 10 códigos por hora por usuario, contados en Redis de forma atómica antes de comparar y
    compartidos por todas sus sesiones (muchas peticiones al mismo tiempo no ganan intentos). La espera tras varias
    contraseñas equivocadas es por correo **e IP**: desde otra IP nadie deja fuera al dueño; el desafío y el aviso
    siguen contando por cuenta. Cambiar los enlaces públicos (Telegram, broker, correo) también pide confirmación.
  - Los enlaces de los correos llevan el secreto después de `#`, que el navegador no envía a ningún servidor, y el
    correo se confirma con un botón (los lectores de correo que abren enlaces solos no lo confirman).
  - Registro y recuperar contraseña responden igual exista o no el correo; si ya existe, se le avisa al dueño.

## 4. Cifrado de datos

### 4.1. Lo que se cifra campo por campo
Con **AES-256-GCM** en la API (cifrado autenticado: si alguien altera el dato, no se descifra):
- Contraseña de operación y contraseña de inversor de cada cuenta de trading.
- Número de cédula (se guarda también su HMAC para buscar duplicados sin descifrar).
- Secreto del segundo factor (TOTP) de cada usuario.

### 4.2. Llaves
- La llave de cifrado vive en una **variable de entorno del servidor** (`DATA_ENCRYPTION_KEY`), nunca en el código ni
  en la base de datos. Cada dato cifrado guarda la versión de la llave, para poder **rotarla** sin perder nada:
  `DATA_ENCRYPTION_KEY_ANTERIOR` permite leer lo viejo mientras el paso previo al despliegue lo vuelve a cifrar con la
  nueva. Las llaves de búsqueda y de auditoría también se rotan (la de auditoría conserva la anterior para revisar las
  filas viejas). Procedimiento completo en `docs/ROTACION-CREDENCIALES.md`.
- Llaves distintas para desarrollo y producción. Copia de las llaves de producción en el gestor de contraseñas
  compartido de Argemiro y Dylan (**operación**): si se pierden, los datos cifrados no se recuperan.

### 4.3. Cómo se ven las contraseñas de trading
- Nunca aparecen en listas, correos, registros ni exportaciones.
- Se descifran solo cuando un admin pulsa "Ver contraseñas" con el segundo factor confirmado. Cada vista queda en la
  auditoría (quién, cuándo, qué cuenta) y se ocultan solas a los 60 segundos.
- Se borran 90 días después de desconectar una cuenta que no renovó (ver la política de datos).

### 4.4. Huellas del control de la prueba (retirado)
- Se quitó con la licencia de prueba el 2026-10-15: ya no hay registro de huellas ni `TRIAL_HMAC_KEY`. El número se
  conserva para no romper referencias.

### 4.5. En tránsito y en reposo
- HTTPS en todo (Vercel y Railway o Render lo dan). Conexión a PostgreSQL y Redis con TLS.
- La base de datos y el almacenamiento de archivos además van cifrados en disco por el proveedor.

## 5. Direcciones de depósito

Es el punto más sensible: quien cambie una dirección se queda con los pagos.

- Agregar o cambiar una dirección exige **segundo factor confirmado**.
- Se valida el formato de la dirección según la red (Tron y Bitcoin, con su checksum).
- **Aviso inmediato por correo a los dos admins** con la dirección nueva completa.
- La dirección nueva queda **"en espera" 24 horas** antes de mostrarse a los clientes. En ese tiempo, cualquiera de
  los dos admins puede cancelarla.
- Cada orden guarda la dirección con la que se creó y no cambia después.
- **Las direcciones iniciales son de la cuenta de Binance de Argemiro** (2026-10-14). Funcionan: USDT por Tron y BTC
  no piden memo, y la verificación en la blockchain es la misma. Como el dinero queda en Binance, esa cuenta es
  ahora el activo más valioso (**operación**):
  - Segundo factor fuerte en Binance (llave de seguridad o passkey, mejor que SMS) y código antiphishing activado.
  - **Lista blanca de retiros** activada: el dinero solo puede salir a direcciones aprobadas antes.
  - No crear llaves de API con permiso de retiro. Si algún día se usa la API de Binance, solo de lectura y limitada a
    la IP del servidor.
  - Revisar en la app de Binance, de vez en cuando, que la dirección de depósito de USDT (Tron) y la de BTC sigan
    siendo las mismas que muestra la plataforma.
- **Riesgos de usar una cuenta personal de exchange para cobrar:**
  - Binance puede pedir información sobre el origen de depósitos frecuentes de terceros, o retener alguno mientras
    Argemiro confirma quién lo envió (regla de viaje). La plataforma guarda cada orden con su cliente, monto y hash,
    lo que sirve para responder esas preguntas.
  - Si Binance congela la cuenta, los pagos que lleguen mientras tanto quedan retenidos. Por eso conviene pasar el
    dinero a una billetera propia de forma periódica y migrar a Binance Pay Merchant cuando lo aprueben.

## 6. Pagos

- La verificación en blockchain la hace **el servidor**: lo que reporta el cliente es solo el hash.
- Montos en unidades enteras de cada moneda (sin decimales flotantes): USDT en Tron usa 6 decimales y BTC 8.
- Índice único por red y hash en la base de datos: un hash no se puede usar en dos órdenes, ni siquiera con dos
  peticiones al mismo tiempo.
- **Pagos que otro cliente pudo enviar** (etapa 9, cambiado el 2026-10-18): todas las órdenes usan la misma
  dirección de depósito, así que alguien podría reportar como suyo el hash del pago de otro.
  - **USDT:** desde el 2026-10-18 se cobra el **precio exacto** (USD 125 → 125 USDT), porque los clientes enviaban la
    cifra redonda y los centavos de diferencia hacían fallar la verificación. Como el monto ya no distingue a quién
    pertenece el pago, la verificación cuenta las órdenes de **otros** clientes por el mismo monto y red que pudieron
    ser las dueñas del pago (pendientes o vencidas sin reportar, creadas antes del envío y vencidas hace menos de una
    hora). Si hay alguna, el pago queda **"por confirmar"** (`POR_CONFIRMAR`): no se aprueba solo ni con "Aprobar";
    un admin confirma con el cliente (captura del envío) y usa "Aprobar de todos modos".
  - **BTC:** el monto sale de la cotización y nunca es redondo; cada orden abierta pide unos satoshis menos (de 1 a
    999, al azar con un candado por red), distintos de las demás. La verificación exige el monto exacto.
  - Un monto mayor queda para revisión manual.
- Aprobar un pago bloquea la fila de la orden en una transacción, para que no se apruebe dos veces.
- Los trabajos del worker son idempotentes: si se repiten, no duplican licencias ni días.
- La aprobación automática (apagada por defecto) solo aprueba órdenes verificadas con todas las confirmaciones.
- Si el proveedor de la blockchain no responde, la orden queda "por verificar" y se reintenta; nunca se aprueba sin
  verificar.
- **Turnstile** (registro y otros formularios públicos): el token se valida en la API con `siteverify` (éxito y que se
  haya resuelto en el dominio de la web); si Cloudflare no responde, no pasa. Los errores de consola
  "Refused to connect to 'data:,'" vienen del **iframe de Cloudflare** y de su propia política (no de la nuestra): no
  afectan el desafío y no se agrega `data:` a nuestra `connect-src` (2026-10-18).

- **Pagos de referidos** (etapa 11): se envían a mano desde Binance a la dirección que quedó copiada en el pago.
  - Cambiar la dirección de cobro pide confirmar la identidad (contraseña o código de la app, 5 minutos), se valida la
    suma de control de Tron, se limita a 5 cambios por día y avisa por correo. Lo que se cierre en las 48 horas
    siguientes a un cambio queda en espera: quien robe la sesión no alcanza a desviar un pago sin que el dueño se
    entere.
  - Marcar un pago enviado, habilitar referidores, corregir el referidor de un cliente, anular comisiones y cambiar
    los ajustes del programa piden el código de la app y quedan en la auditoría (`referido.*`).
  - El código de invitación es aleatorio (`crypto.randomInt`, 31⁸ combinaciones) y la consulta pública "Te invitó"
    tiene un límite de 60 por hora por IP. La cookie `ref` es httpOnly, `sameSite: lax` y dura 30 días.
  - Quien refiere solo ve el nombre de pila y la inicial de sus referidos (de las dos líneas); nunca correos,
    documentos ni cuentas.
  - Nadie cobra por sus propias compras: la comisión salta a quien sea el comprador, y corregir el referidor de un
    cliente se rechaza si formaría un ciclo en la red.

## 7. Entradas de datos y archivos

- Toda entrada pasa por validación estricta (DTO con `class-validator` en modo lista blanca, y los mismos esquemas en
  `packages/shared`). Los campos que no están en el esquema se rechazan.
- Consultas a la base de datos siempre parametrizadas con TypeORM; nunca SQL armado con texto del usuario.
- Los mensajes de soporte se muestran como texto plano, sin HTML.
- **Archivos adjuntos:**
  - Imágenes (JPG, PNG, WEBP) o PDF, hasta 10 MB, máximo 5 por mensaje. El tipo se comprueba por el contenido del
    archivo, no por su extensión.
  - Las imágenes se vuelven a codificar en el servidor, lo que borra metadatos como la ubicación GPS.
  - Se guardan con nombre aleatorio en un **almacenamiento privado** y se entregan con enlaces firmados que vencen en
    5 minutos, como descarga (`Content-Disposition: attachment`).
  - Revisión antivirus de los PDF antes de mostrarlos a los admins (fase 1 si el costo lo permite; si no, al poco
    tiempo de lanzar).
  - Construido en la etapa 7 (2026-10-15): la subida va directo a la API (`/archivos/subir`) con una ficha HMAC de
    30 minutos ligada al usuario (llave derivada de `LOOKUP_HMAC_KEY`), sin el secreto de la web; el cuerpo se
    corta a los 10 MB, el tipo se lee de los primeros bytes (un SVG o un ejecutable con nombre `.png` se rechazan)
    y `sharp` vuelve a codificar las imágenes con un tope de 50 megapíxeles. El nombre que se muestra se limpia
    (sin rutas, caracteres de control ni de dirección) y lleva la extensión del tipo real. Un archivo solo se
    adjunta a un mensaje de quien lo subió; el cliente nunca descarga adjuntos de notas internas ni de tickets
    ajenos. Límites: 40 subidas por hora y 20 archivos sin usar por usuario; los que nadie adjunta se borran a las
    24 horas. La revisión antivirus de los PDF sigue pendiente.

## 8. Datos personales (Ley 1581)

- Solo se piden los datos necesarios. La cédula se muestra enmascarada (últimos 4 dígitos) salvo acción explícita.
- Casilla de autorización en el registro y prueba guardada (fecha, IP, versión de la política).
- Plazos de borrado automáticos según `docs/legal/politica-datos.md`, ejecutados por el worker.
- El cliente pide que se elimine su cuenta desde su perfil (abre un ticket) y un admin la elimina desde su ficha,
  con el segundo factor: se anonimizan sus datos y se conservan las órdenes y los pagos (etapa 9).
- "Descargar mis datos" en Mi perfil (2026-10-16, derecho de acceso de la Ley 1581): un archivo JSON con perfil,
  autorizaciones, cuentas, licencias, pagos, tickets y dispositivos. No incluye las contraseñas de las cuentas, las
  notas internas de los admins ni la cédula completa (se pide por ticket, así una sesión robada no la entrega).
  Límite de 5 descargas por hora y registro en la auditoría (`datos.descargados`).
- Nunca se usan datos reales de producción en desarrollo.

## 9. Abuso y bots

- **Cloudflare Turnstile** (gratis, sin imágenes molestas) en registro, recuperar contraseña y en el ingreso después
  de varios fallos.
- **Límites de velocidad** con Redis en toda la API (600 peticiones cada 5 minutos por IP), más estrictos en ingreso
  (30 cada 15 minutos por IP), registro (5 por hora por IP) y correos (10 por hora por IP y 3 por hora por cuenta).
  Se hizo un limitador propio de ventana fija en vez de `@nestjs/throttler`, porque las reglas por cuenta (correo)
  no son por ruta.

## 10. Dominio, correo y cuentas de servicio (operación)

- **Segundo factor en todas las cuentas:** GitHub, Vercel, Railway o Render, Resend, Cloudflare, Hostinger,
  Binance y los correos de Google de Argemiro y Dylan. Códigos de recuperación en el gestor de contraseñas.
- **Gestor de contraseñas compartido** (Bitwarden o 1Password) para las credenciales de la plataforma. Nada de
  contraseñas por chat.
- **Hostinger:** bloqueo de transferencia del dominio, renovación automática y DNSSEC si está disponible.
- **Correo:** SPF, DKIM y DMARC configurados. DMARC empieza en `p=none` para revisar informes, y pasa a
  `p=quarantine` y luego a `p=reject` cuando todo esté en orden.
- Los correos de la plataforma **nunca piden contraseñas ni códigos**, y lo dicen en el pie. El panel del cliente
  repite que DocTraderPRO solo muestra direcciones de pago dentro del panel.

## 11. Encabezados y configuración web

- `Strict-Transport-Security` (HSTS) con un año de duración.
- `Content-Security-Policy` estricta; el único script de terceros es Turnstile. Solo `/presentacion` permite además
  el iframe del gráfico de TradingView (`frame-src` con `s.tradingview.com` y `www.tradingview-widget.com`, en un
  iframe con `sandbox`). El widget de Myfxbook es una imagen:
  se permiten sus dominios de imágenes (`widgets.myfxbook.com` y `widget.mfbcdn.net`).
  - **Decisión (2026-10-14):** sin nonces por ahora. Con nonces todas las páginas pasan a ser dinámicas y se pierde
    el prerenderizado de la landing; React escapa todo lo que muestra y la web no inserta HTML de usuarios. Se
    permite `'unsafe-inline'` en scripts solo del propio sitio, y se reemplaza por la integridad de subrecursos (SRI)
    de Next cuando deje de ser experimental.
- `frame-ancestors 'none'` (nadie puede meter la plataforma en un iframe), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` sin cámara, micrófono ni ubicación.
- CORS de la API abierto solo para `https://www.doctraderpro.com` (la web; `doctraderpro.com` redirige ahí).

## 12. Base de datos, copias y auditoría

- Usuario de base de datos de la app **sin permisos de administrador**; otro usuario solo para migraciones.
- **Copias de seguridad:** las automáticas del proveedor (diarias, con restauración a un momento si el plan lo
  permite) más una copia cifrada diaria en un almacenamiento distinto, guardada 30 días.
  **Restauración de prueba una vez al mes** (operación): una copia que nunca se ha restaurado no es una copia.
- **Auditoría que no se puede editar:** la app solo puede insertar en la tabla de auditoría (sin permisos de cambiar
  ni borrar), y cada registro lleva el hash del anterior, para detectar si alguien la alteró.
  Se audita: ingresos de admins, aprobación o rechazo de pagos, vistas de contraseñas, cambios de direcciones,
  precios, ajustes y comisión, extensiones de días, suspensiones, exportaciones y eliminación de clientes. El worker
  recalcula la cadena cada día y avisa a los admins si no cuadra (etapa 9).
- **Pendiente (operación):** la API usa hoy el usuario dueño de las tablas; separar un usuario sin permisos de
  administrador para la app y otro para las migraciones. Las copias: ver README, "Copias de seguridad".

## 13. Código, dependencias y despliegue

- Rama principal protegida: todo entra por pull request con revisión y pruebas en verde.
- Pruebas automáticas de lo crítico: permisos (que un cliente no vea lo de otro), pagos, licencias y días, cifrado.
- Revisión automática de dependencias (Dependabot), análisis de código (CodeQL) y búsqueda de secretos filtrados
  (gitleaks) en cada pull request.
- `pnpm-lock.yaml` versionado; nada de instalar paquetes sin revisar.
- Secretos solo en las variables de entorno de Vercel y Railway o Render, separados por entorno. El repositorio solo
  tiene un `.env.example` sin valores.
- Migraciones revisadas antes de aplicarse en producción.

## 14. Monitoreo y respuesta a incidentes

- Errores en Sentry, con los datos personales y secretos filtrados antes de enviarse.
- Registros sin datos sensibles (ni contraseñas, ni cédulas completas, ni tokens).
- Monitor de disponibilidad de la web y la API con alerta a los dos admins (operación: `/salud` está lista).
- Construido en la etapa 9: Sentry (API, worker y servidor de la web) sin cuerpos, cookies, parámetros, encabezados
  sensibles, usuario ni migas; alertas de pagos sin verificar en una hora, más de 50 ingresos fallidos en una hora,
  trabajos del worker que fallan y auditoría alterada (`apps/api/src/monitoreo/`).
- Alertas por: muchos ingresos fallidos, trabajos del worker que fallan, pagos sin verificar por más de una hora y
  cambios de direcciones de depósito.
- **Si pasa algo** (operación):
  1. Contener: cerrar sesiones, desactivar la cuenta afectada y, si hace falta, poner la plataforma en mantenimiento.
  2. Rotar las llaves y contraseñas comprometidas.
  3. Revisar la auditoría para saber qué pasó y a quién afectó.
  4. Avisar a los clientes afectados y a la Superintendencia de Industria y Comercio cuando la ley lo exija.
  5. Anotar qué falló y cómo se evita la próxima vez.
