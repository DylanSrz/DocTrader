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
| **Datos personales** (cédula, teléfono, foto) | Filtración | Cifrado, mínimo acceso, plazos de borrado (§4, §8) |
| **Regla de una prueba** | Abuso con datos de otros | Control de la prueba de `CONTEXTO.md` y huellas HMAC (§4.4) |
| **Dominio y correo** | Suplantación (phishing con el nombre de la marca) | SPF, DKIM, DMARC, bloqueo del dominio (§10) |

La plataforma **nunca guarda llaves privadas de billeteras**: solo direcciones públicas. Aunque alguien tomara el
control total del servidor, no podría mover el dinero de Argemiro.

## 2. Ingreso y contraseñas

- Contraseñas guardadas con **Argon2id** (nunca en texto ni con cifrado reversible).
- Mínimo **10 caracteres**, sin reglas raras de composición. Se rechazan las contraseñas filtradas consultando
  Have I Been Pwned por rango (k-anonimato: la contraseña nunca sale del servidor).
- **Límite de intentos** por IP y por cuenta: después de 5 fallos, espera creciente; después de 10, se pide el
  desafío de Cloudflare Turnstile y se avisa por correo al dueño de la cuenta.
- Mensajes de error genéricos ("correo o contraseña incorrectos"), para no revelar qué correos están registrados.
- **Recuperar contraseña:** enlace de un solo uso, válido 30 minutos, guardado como hash. Al cambiarla se cierran
  todas las sesiones.
- **Verificación del correo** al registrarse y **del teléfono por SMS** (Twilio Verify) para pedir la prueba.

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
  `https://doctraderpro.com`.

## 4. Cifrado de datos

### 4.1. Lo que se cifra campo por campo
Con **AES-256-GCM** en la API (cifrado autenticado: si alguien altera el dato, no se descifra):
- Contraseña de operación y contraseña de inversor de cada cuenta de trading.
- Número de cédula (se guarda también su HMAC para buscar duplicados sin descifrar).
- Secreto del segundo factor (TOTP) de cada usuario.
- Foto del documento, antes de subirla al almacenamiento.

### 4.2. Llaves
- La llave de cifrado vive en una **variable de entorno del servidor** (`DATA_ENCRYPTION_KEY`), nunca en el código ni
  en la base de datos. Cada dato cifrado guarda la versión de la llave, para poder **rotarla** sin perder nada.
- Llaves distintas para desarrollo y producción. Copia de las llaves de producción en el gestor de contraseñas
  compartido de Argemiro y Dylan (**operación**): si se pierden, los datos cifrados no se recuperan.

### 4.3. Cómo se ven las contraseñas de trading
- Nunca aparecen en listas, correos, registros ni exportaciones.
- Se descifran solo cuando un admin pulsa "Ver contraseñas" con el segundo factor confirmado. Cada vista queda en la
  auditoría (quién, cuándo, qué cuenta) y se ocultan solas a los 60 segundos.
- Se borran 90 días después de desconectar una cuenta que no renovó (ver la política de datos).

### 4.4. Huellas del control de la prueba
- HMAC-SHA256 con una llave propia (`TRIAL_HMAC_KEY`), distinta de la de cifrado.
- Esta llave **no se puede rotar borrando la anterior**, porque las huellas viejas dejarían de coincidir: se agrega
  una versión nueva y se comparan las dos.

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
- Recomendación (**operación**): usar direcciones de billeteras propias (de autocustodia o de hardware), no de
  exchanges, que pueden cambiar o pedir memo.

## 6. Pagos

- La verificación en blockchain la hace **el servidor**: lo que reporta el cliente es solo el hash.
- Montos en unidades enteras de cada moneda (sin decimales flotantes): USDT en Tron usa 6 decimales y BTC 8.
- Índice único por red y hash en la base de datos: un hash no se puede usar en dos órdenes, ni siquiera con dos
  peticiones al mismo tiempo.
- Aprobar un pago bloquea la fila de la orden en una transacción, para que no se apruebe dos veces.
- Los trabajos del worker son idempotentes: si se repiten, no duplican licencias ni días.
- La aprobación automática (apagada por defecto) solo aprueba órdenes verificadas con todas las confirmaciones.
- Si el proveedor de la blockchain no responde, la orden queda "por verificar" y se reintenta; nunca se aprueba sin
  verificar.

## 7. Entradas de datos y archivos

- Toda entrada pasa por validación estricta (DTO con `class-validator` en modo lista blanca, y los mismos esquemas en
  `packages/shared`). Los campos que no están en el esquema se rechazan.
- Consultas a la base de datos siempre parametrizadas con TypeORM; nunca SQL armado con texto del usuario.
- Los mensajes de soporte se muestran como texto plano, sin HTML.
- **Archivos adjuntos y foto del documento:**
  - Imágenes (JPG, PNG, WEBP) o PDF, hasta 10 MB, máximo 5 por mensaje. El tipo se comprueba por el contenido del
    archivo, no por su extensión.
  - Las imágenes se vuelven a codificar en el servidor, lo que borra metadatos como la ubicación GPS.
  - Se guardan con nombre aleatorio en un **almacenamiento privado** y se entregan con enlaces firmados que vencen en
    5 minutos, como descarga (`Content-Disposition: attachment`).
  - Revisión antivirus de los PDF antes de mostrarlos a los admins (fase 1 si el costo lo permite; si no, al poco
    tiempo de lanzar).

## 8. Datos personales (Ley 1581)

- Solo se piden los datos necesarios. La cédula se muestra enmascarada (últimos 4 dígitos) salvo acción explícita.
- Casilla de autorización en el registro y prueba guardada (fecha, IP, versión de la política).
- Plazos de borrado automáticos según `docs/legal/politica-datos.md`, ejecutados por el worker.
- El cliente puede descargar sus datos y pedir que se elimine su cuenta desde su perfil.
- Nunca se usan datos reales de producción en desarrollo.

## 9. Abuso y bots

- **Cloudflare Turnstile** (gratis, sin imágenes molestas) en registro, recuperar contraseña, solicitud de prueba,
  envío de SMS y en el ingreso después de varios fallos.
- **Límites de velocidad** con `@nestjs/throttler` y Redis en toda la API, más estrictos en ingreso, registro y SMS.
- **SMS:** máximo 3 códigos por teléfono por hora y 5 por día, y límite por IP. En Twilio, permisos geográficos solo
  para los países donde se vende (al inicio, Colombia) y protección contra fraude de SMS activada, para evitar que
  bots generen mensajes que cobran a la cuenta.

## 10. Dominio, correo y cuentas de servicio (operación)

- **Segundo factor en todas las cuentas:** GitHub, Vercel, Railway o Render, Resend, Twilio, Cloudflare, Hostinger,
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
- `Content-Security-Policy` estricta con nonces en Next.js; el único script de terceros es Turnstile. El widget de
  Myfxbook es una imagen: se permiten sus dominios de imágenes (`widgets.myfxbook.com` y `widget.mfbcdn.net`).
- `frame-ancestors 'none'` (nadie puede meter la plataforma en un iframe), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` sin cámara, micrófono ni ubicación.
- CORS de la API abierto solo para `https://doctraderpro.com`.

## 12. Base de datos, copias y auditoría

- Usuario de base de datos de la app **sin permisos de administrador**; otro usuario solo para migraciones.
- **Copias de seguridad:** las automáticas del proveedor (diarias, con restauración a un momento si el plan lo
  permite) más una copia cifrada semanal en un almacenamiento distinto, guardada 30 días.
  **Restauración de prueba una vez al mes** (operación): una copia que nunca se ha restaurado no es una copia.
- **Auditoría que no se puede editar:** la app solo puede insertar en la tabla de auditoría (sin permisos de cambiar
  ni borrar), y cada registro lleva el hash del anterior, para detectar si alguien la alteró.
  Se audita: ingresos de admins, aprobación o rechazo de pagos, vistas de contraseñas, cambios de direcciones,
  precios, ajustes y comisión, extensiones de días, suspensiones y exportaciones.

## 13. Código, dependencias y despliegue

- Rama principal protegida: todo entra por pull request con revisión y pruebas en verde.
- Pruebas automáticas de lo crítico: permisos (que un cliente no vea lo de otro), pagos, licencias y días, control de
  la prueba, cifrado.
- Revisión automática de dependencias (Dependabot), análisis de código (CodeQL) y búsqueda de secretos filtrados
  (gitleaks) en cada pull request.
- `pnpm-lock.yaml` versionado; nada de instalar paquetes sin revisar.
- Secretos solo en las variables de entorno de Vercel y Railway o Render, separados por entorno. El repositorio solo
  tiene un `.env.example` sin valores.
- Migraciones revisadas antes de aplicarse en producción.

## 14. Monitoreo y respuesta a incidentes

- Errores en Sentry, con los datos personales y secretos filtrados antes de enviarse.
- Registros sin datos sensibles (ni contraseñas, ni cédulas completas, ni tokens).
- Monitor de disponibilidad de la web y la API con alerta a los dos admins.
- Alertas por: muchos ingresos fallidos, picos de SMS, trabajos del worker que fallan, pagos sin verificar por más de
  una hora y cambios de direcciones de depósito.
- **Si pasa algo** (operación):
  1. Contener: cerrar sesiones, desactivar la cuenta afectada y, si hace falta, poner la plataforma en mantenimiento.
  2. Rotar las llaves y contraseñas comprometidas.
  3. Revisar la auditoría para saber qué pasó y a quién afectó.
  4. Avisar a los clientes afectados y a la Superintendencia de Industria y Comercio cuando la ley lo exija.
  5. Anotar qué falló y cómo se evita la próxima vez.
