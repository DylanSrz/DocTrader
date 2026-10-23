# Rotación de credenciales

Cómo cambiar todas las credenciales de producción sin perder datos ni dejar la plataforma caída. Se escribió por el
**incidente de seguridad de Railway del 21 de octubre de 2026**: Railway pidió rotar todo lo guardado en sus variables
de entorno (informe preliminar: https://blog.railway.com/p/preliminary-report-october-security-incident). Sirve igual
para cualquier rotación futura.

## Reglas

1. **Nunca pegues un valor en el chat, en un correo ni en un documento.** Se genera, se guarda en el gestor de
   contraseñas y se pega directo en Railway, Vercel o GitHub.
2. Las llaves propias se generan con `openssl rand -base64 32` (o con el generador del gestor: 32 bytes en base64).
   Para contraseñas de base de datos y Redis: `openssl rand -hex 24` (sin caracteres raros).
3. **Primero lo nuevo, después se revoca lo viejo:** crear la credencial nueva → ponerla → desplegar → comprobar →
   recién entonces borrar la vieja.
4. En Railway, marca las variables secretas como **Sealed** (menú ⋮ de la variable): después nadie puede leerlas desde
   el panel ni desde la API, ni siquiera tú. Por eso el gestor de contraseñas va primero.
5. Railway: la API es `@doctrader/api`, el worker es `worker`. Las variables de la app se ponen **en los dos** salvo que
   se diga otra cosa.

Quién hace cada cosa: **Dylan** (o Argemiro) entra a los paneles y pega los valores; el desarrollo (Claude) despliega,
lee los registros y comprueba. Ningún valor pasa por el desarrollo.

## Fase 0 — Código

Desde el PR "Rotación de credenciales", la API sabe:
- leer con la llave de cifrado anterior mientras vuelve a cifrar todo con la nueva (`DATA_ENCRYPTION_KEY_ANTERIOR`);
- revisar la auditoría vieja con la llave anterior (`AUDIT_HMAC_KEY_ANTERIOR`);
- cambiar la contraseña de Postgres en el paso previo al despliegue (`CONTRASENA_DB_ANTERIOR`).

Sin esas variables todo funciona como antes. Ese PR va a `main` antes de empezar.

## Fase 1 — Servicios externos

Para cada uno: crear la credencial nueva, ponerla, desplegar (Railway despliega solo al cambiar una variable),
comprobar y revocar la vieja.

| Credencial | Dónde se crea | Dónde se pone | Cómo se comprueba |
|---|---|---|---|
| `RESEND_API_KEY` | Resend → API Keys → Create (permiso "Sending access", dominio doctraderpro.com) | Railway → worker | Un correo de prueba: "Olvidé mi contraseña" con un correo de admin |
| `BINANCE_API_KEY` y `BINANCE_API_SECRET` | Binance → Gestión de API → crear (**solo lectura**, con lista de IP si la cuenta lo permite) | Railway → worker | Registros del worker sin errores de Binance |
| `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage API tokens → token nuevo con "Object Read & Write" solo en `doctrader-adjuntos` | Railway → API y worker | Subir un adjunto en un ticket de prueba |
| `BACKUP_R2_ACCESS_KEY_ID` y `BACKUP_R2_SECRET_ACCESS_KEY` | Igual, solo en el depósito de copias | GitHub → Settings → Secrets → Actions | Correr a mano el flujo "Copia de seguridad" |
| `TURNSTILE_SECRET` | Cloudflare → Turnstile → el sitio → Rotate secret key | Railway → API | Registrarse o ingresar en la web |
| `SENTRY_DSN` (opcional, no es muy sensible) | Sentry → Project → Client Keys → nueva | Railway → API y worker; Vercel (`SENTRY_DSN` de la web) | Un error de prueba aparece en Sentry |

Revocar las viejas en cada proveedor cuando la comprobación pase.

## Fase 2 — Contraseña de Postgres

Las variables de Postgres (`PGPASSWORD`, `DATABASE_URL`, `DATABASE_PUBLIC_URL`) salen de `POSTGRES_PASSWORD`, y la API y
el worker usan `${{Postgres.DATABASE_URL}}`. Pero la contraseña real vive dentro de la base y solo cambia con
`ALTER ROLE`: eso lo hace el paso previo al despliegue de la API, en un solo despliegue.

1. **Dylan:** genera la contraseña nueva (`openssl rand -hex 24`) y guárdala en el gestor. Copia también la actual
   (Railway → `Postgres` → Variables → `POSTGRES_PASSWORD`).
2. **Dylan, en un solo cambio** (sin desplegar entre una y otra):
   - Railway → `@doctrader/api` → `CONTRASENA_DB_ANTERIOR` = la contraseña **actual** (Sealed);
   - Railway → `Postgres` → `POSTGRES_PASSWORD` = la **nueva**.

   Desplegar los cambios. La base de datos no relee `POSTGRES_PASSWORD` al reiniciar, así que no pasa nada si
   Railway también la reinicia.
3. Lo que pasa solo: el paso previo de la API intenta entrar con la nueva; la base la rechaza; entra con la anterior,
   cambia la contraseña y vuelve a entrar. En el registro del despliegue: "Base de datos: contraseña cambiada por la
   nueva de las variables de Postgres", más una fila `seguridad.contrasena_db_cambiada` en la auditoría. El worker
   puede reiniciarse una vez mientras tanto: es normal.
4. **Desarrollo:** comprueba que la API (`/salud`) y el worker arrancan.
5. **Dylan:** borra `CONTRASENA_DB_ANTERIOR` de la API.
6. **Dylan:** GitHub → Settings → Secrets → `BACKUP_DATABASE_URL` = el nuevo valor de `DATABASE_PUBLIC_URL` de Postgres.
   **Desarrollo:** corre la copia de seguridad a mano y comprueba que pasa.

## Fase 3 — Contraseña de Redis

Redis arranca con `--requirepass $REDIS_PASSWORD`, y `REDIS_URL` sale de esa variable.

1. **Dylan:** Railway → `Redis` → Variables → `REDIS_PASSWORD` = nueva (`openssl rand -hex 24`). Si `REDISPASSWORD` o
   `REDIS_URL` no son referencias a `REDIS_PASSWORD` (`${{REDIS_PASSWORD}}`), cámbialas también.
2. Desplegar Redis, la API y el worker. Redis se cae unos segundos: se pierden las sesiones (todos vuelven a ingresar)
   y los trabajos en cola se reintentan.
3. **Desarrollo:** comprueba `/salud` (incluye Redis y el latido del worker).

## Fase 4 — Llaves de la aplicación

Con la base recién limpiada (2026-10-23) lo único cifrado es el segundo factor de los admins, así que es el mejor
momento. Generar 4 valores con `openssl rand -base64 32` y guardarlos en el gestor **antes** de tocar Railway,
junto con los actuales `DATA_ENCRYPTION_KEY` y `AUDIT_HMAC_KEY` (se copian del panel: después se sellan).

En Railway, en **la API y el worker**, en un solo cambio:

| Variable | Valor |
|---|---|
| `DATA_ENCRYPTION_KEY_ANTERIOR` | el valor **actual** de `DATA_ENCRYPTION_KEY` |
| `DATA_ENCRYPTION_KEY` | la llave nueva |
| `DATA_ENCRYPTION_KEY_VERSION` | `2` (en la próxima rotación, `3`, y así) |
| `AUDIT_HMAC_KEY_ANTERIOR` | el valor **actual** de `AUDIT_HMAC_KEY` |
| `AUDIT_HMAC_KEY` | la llave nueva |
| `LOOKUP_HMAC_KEY` | la llave nueva |
| `PROXY_SECRET` (solo API) | el secreto nuevo |

Y en Vercel → proyecto `doc_trader_pro` → Settings → Environment Variables → `PROXY_SECRET` (Production) = el mismo
secreto nuevo, y **Redeploy** de producción. Entre el despliegue de Railway y el de Vercel la web no puede hablar con
la API (unos minutos): hacerlo seguido.

Qué pasa al desplegar:
- El paso previo de la API vuelve a cifrar todo con la llave nueva y deja en el registro "Cifrado: datos vueltos a
  cifrar con la llave versión 2 (...)", más una fila `seguridad.datos_recifrados` en la auditoría.
- Las sesiones se cierran (las huellas cambiaron con `LOOKUP_HMAC_KEY`): todos vuelven a ingresar.
- **Los códigos de recuperación de los admins dejan de servir** (también son huellas). Cada admin, después de ingresar:
  Admin → sección "Seguridad" → generar códigos nuevos → guardarlos en el gestor.
- Los enlaces de correo que estaban pendientes (verificar correo, recuperar contraseña) dejan de servir: se piden otra vez.

Después:
1. **Desarrollo:** comprueba que los dos admins pueden ingresar con su segundo factor y que la revisión de la
   auditoría pasa con las dos llaves.
2. **Dylan:** borra `DATA_ENCRYPTION_KEY_ANTERIOR` de la API y del worker (la llave vieja queda inservible). En el
   siguiente despliegue el registro dice "todo ya está con la llave versión 2".
3. `AUDIT_HMAC_KEY_ANTERIOR` **se queda para siempre** (y en el gestor): sin ella, la auditoría vieja no se puede
   verificar.

## Fase 5 — Revisar actividad

- Resend → Logs: ¿correos que no enviamos?
- Binance → historial de la API y de retiros (la llave era de solo lectura, pero revisar igual).
- Cloudflare → R2 → métricas del depósito: ¿lecturas o borrados raros?
- La auditoría de la plataforma (Admin) y la revisión diaria de la cadena: sin alertas.
- Railway → Workspace → Members y Tokens: nadie de más; borrar tokens que no se usen.
- GitHub → Settings → Applications y Personal access tokens: lo mismo.

## Qué queda en el gestor de contraseñas al final

Todas las credenciales nuevas, más `AUDIT_HMAC_KEY_ANTERIOR`, la `DATA_ENCRYPTION_KEY` vieja (solo para abrir copias
de seguridad anteriores a la rotación) y los códigos de recuperación nuevos de los admins.
