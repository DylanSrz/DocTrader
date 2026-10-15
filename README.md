# DocTrader

Plataforma web de licencias para **Doc Trader Pro AI** (doctraderpro.com).

- [Contexto y decisiones](docs/CONTEXTO.md) · [Pendientes](docs/PENDIENTES.md) ·
  [Documento de requerimientos](https://claude.ai/code/artifact/12e017f5-308d-45a5-bf40-89b2d4b6f121)
- [Modelo de datos y estados](docs/MODELO-DATOS.md) · [Plan de trabajo](docs/PLAN-TRABAJO.md) ·
  [Seguridad](docs/SEGURIDAD.md) · [Decisiones técnicas](docs/DECISIONES-TECNICAS.md)
- Diseño de referencia: [propuesta 2](design/propuesta-2/README.md)

## Estructura

| Carpeta | Qué es |
|---|---|
| `apps/web` | Página pública y paneles (Next.js 16, Tailwind 4) |
| `apps/api` | API y worker (NestJS 12, TypeORM, BullMQ). Mismo código, dos comandos de arranque |
| `packages/shared` | Tipos y reglas de negocio puras (fechas de licencia, dinero, planes), con sus pruebas |
| `docker/` | Servicios de desarrollo: PostgreSQL, Redis, Mailpit y Adminer |
| `docs/`, `design/` | Planeación y prototipos |

## Desarrollo

Requisitos: Node 22 (ver `.nvmrc`), pnpm 10 (`corepack enable`) y Docker.

```bash
pnpm install
pnpm servicios                         # PostgreSQL, Redis, Mailpit (localhost:8025) y Adminer (localhost:8080)
cp apps/api/.env.example apps/api/.env # llena AUDIT_HMAC_KEY, DATA_ENCRYPTION_KEY, LOOKUP_HMAC_KEY y PROXY_SECRET
                                       # (cada una: openssl rand -base64 32)
cp apps/web/.env.example apps/web/.env.local # PROXY_SECRET igual al de la API
pnpm db:migrar                         # crea las tablas
pnpm db:semilla                        # planes, ajustes, direcciones de depósito y los dos admins
pnpm dev                               # web en localhost:3000, API en localhost:4000
pnpm --filter @doctrader/api dev:worker  # el worker, en otra terminal
```

- `localhost:4000/salud` dice si la API ve la base de datos y Redis, y cuándo fue el último latido del worker.
- `localhost:3000/sistema` muestra el sistema de diseño (no existe en producción).
- Los correos (verificación, recuperar contraseña…) llegan a Mailpit en `localhost:8025`. Sin Mailpit ni Resend,
  el worker los escribe en su consola.
- **Primer ingreso de un admin:** los admins de la semilla no tienen contraseña. Entran por "Olvidé mi contraseña"
  con su correo, crean la contraseña con el enlace y, al ingresar, la plataforma les pide configurar el segundo
  factor antes de dejarlos entrar al panel.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | Revisiones rápidas |
| `pnpm test` | Pruebas unitarias de todos los paquetes |
| `pnpm --filter @doctrader/api test:e2e` | Pruebas de la API contra Postgres y Redis reales, en la base `doctrader_test` (se borra y se recrea) |
| `pnpm build` | Compila todo |

### Convenciones

- Tablas y columnas en inglés, como en `docs/MODELO-DATOS.md`; funciones, módulos y textos en español.
- Las migraciones se escriben a mano, en SQL, en `apps/api/src/database/migraciones/`. Nunca `synchronize`.
- Dinero en enteros: USD en centavos y cripto en unidades base. Fechas de licencia con `sumarMeses` de
  `@doctrader/shared` (hora de Colombia).
- Toda acción delicada se registra con `AuditoriaService`, dentro de la misma transacción que la acción.
- Los correos se dejan en la bandeja de salida (`AvisosService.encolar`) dentro de la transacción de la acción; el
  worker los envía.
- **El navegador nunca habla con la API.** La web (sus acciones del servidor y componentes del servidor) llama a la
  API con `llamarApi`, firmada con `PROXY_SECRET`; la sesión vive en una cookie `HttpOnly` del dominio de la web.
  Toda ruta de la API exige sesión salvo las marcadas `@Publica()`; los roles van con `@Roles()` y las acciones
  delicadas con `@ConfirmacionReciente()`.

## Despliegue

No hay Docker en producción. Las cuentas de Vercel y Railway están a nombre de Dylan (2026-10-14).

### Web — Vercel

1. **Add New → Project** → importar `DylanSrz/DocTrader`.
2. **Root Directory:** `apps/web`. Vercel detecta Next.js y pnpm; el comando de build está en `apps/web/vercel.json`
   (compila primero `packages/shared`).
3. Variables:

   | Variable | Valor |
   |---|---|
   | `API_URL` | El dominio de la API en Railway (después, `https://api.doctraderpro.com`) |
   | `PROXY_SECRET` | El mismo valor que en la API |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave pública de Cloudflare Turnstile (cuando exista la cuenta) |
   | `MOSTRAR_SISTEMA` | `true` solo en *Preview*, para ver `/sistema` |
   | `SENTRY_DSN` | Opcional: el DSN del proyecto de Sentry. Con él, los errores del servidor de la web llegan a Sentry, sin datos personales |
4. El dominio `doctraderpro.com` se conecta cuando la landing esté lista (etapa 2), no antes.

### API y worker — Railway

1. **New Project → Deploy from GitHub repo** → `DylanSrz/DocTrader`. Ese primer servicio es la **API**:
   - Settings: build, arranque, pre-deploy (migraciones y semilla; la semilla no repite ni pisa nada) y `/salud`,
     con los valores de la tabla de "Lo que aprendimos" más abajo.
   - Settings → Networking → **Generate Domain** (después, `api.doctraderpro.com`).
2. En el mismo proyecto: **New → Database → PostgreSQL** y **New → Database → Redis**.
3. **New → GitHub repo** otra vez, mismo repositorio: es el **worker**. Settings con los valores de la tabla de abajo.
   No necesita dominio.
4. Variables, en la API y en el worker (los mismos valores en los dos):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (red privada de Railway) |
   | `DATABASE_SSL` | `false` (la red privada no usa SSL) |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `WEB_ORIGIN` | El dominio de Vercel (después, `https://doctraderpro.com`) |
   | `AUDIT_HMAC_KEY` | Una llave nueva: `openssl rand -base64 32`. Guárdala en el gestor de contraseñas: si se pierde, la auditoría vieja ya no se puede verificar |
   | `DATA_ENCRYPTION_KEY` | Otra llave nueva (`openssl rand -base64 32`). Cifra cédulas y segundos factores: **si se pierde, esos datos no se recuperan** |
   | `LOOKUP_HMAC_KEY` | Otra llave nueva (`openssl rand -base64 32`). Para buscar cédulas repetidas sin descifrarlas |
   | `RESEND_API_KEY` | La llave de Resend (cuando el dominio esté verificado). Sin ella, los correos esperan en cola |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 privado para los adjuntos de soporte (token de R2 con lectura y escritura solo en ese depósito). Sin ellas, los tickets funcionan sin adjuntos |
   | `SENTRY_DSN` | Opcional: el DSN del proyecto de Sentry (el mismo de la web). Sin ella, los errores solo quedan en los registros de Railway |

   Solo en la API, además:

   | Variable | Valor |
   |---|---|
   | `PROXY_SECRET` | Otra llave nueva (`openssl rand -base64 32`), la misma de Vercel. Sin ella la API no arranca en producción |
   | `TURNSTILE_SECRET` | Clave secreta de Cloudflare Turnstile (cuando exista la cuenta) |
   | `COINGECKO_API_KEY` | Opcional: llave gratis de CoinGecko (plan Demo) para comparar el precio de BTC con más consultas |
   | `TRONGRID_API_KEY`, `TRONSCAN_API_KEY` | Opcionales, también en el worker: llaves gratis de TronGrid y Tronscan para verificar pagos en Tron con más consultas |

5. Revisar `https://<dominio-de-la-api>/salud`: debe responder `"estado":"ok"` y, al minuto, mostrar el latido del
   worker. Sin el secreto de la web, cualquier otra ruta responde 404, salvo `/archivos/subir`: la subida de
   adjuntos que hace el navegador directo, con una ficha firmada de 30 minutos (por eso `WEB_ORIGIN` debe ser la
   dirección exacta de la web: es el origen que la API acepta).

### Integración continua

GitHub Actions (`.github/workflows/`) corre formato, lint, tipos, pruebas unitarias, pruebas de punta a punta,
build, búsqueda de secretos (gitleaks) y CodeQL en cada pull request. Dependabot propone actualizaciones cada semana.

### Copias de seguridad

- **Railway:** activar en el servicio de Postgres, pestaña **Backups**, las copias programadas del volumen (diarias)
  y, si el plan lo permite, la recuperación a un momento dado (PITR).
- **Copia semanal fuera de Railway** (`.github/workflows/copia-de-seguridad.yml`): los lunes a las 3:17 a. m. de
  Colombia copia la base de datos, la **restaura en un Postgres vacío y la revisa**, la cifra (AES-256 con una frase) y
  la guarda en un depósito privado de R2, 30 días. Se puede correr a mano desde Actions → "Copia de seguridad" → *Run
  workflow*. Necesita estos secretos del repositorio (Settings → Secrets and variables → Actions); sin ellos avisa y no
  hace nada:

  | Secreto | Valor |
  |---|---|
  | `BACKUP_DATABASE_URL` | La URL pública de Postgres en Railway (`DATABASE_PUBLIC_URL`) |
  | `BACKUP_PASSPHRASE` | Una frase larga (`openssl rand -base64 32`). Guárdala en el gestor de contraseñas: **sin ella las copias no se abren** |
  | `BACKUP_R2_ACCOUNT_ID`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`, `BACKUP_R2_BUCKET` | Un depósito de R2 privado **solo para copias** (`doctrader-copias`) y un token de R2 con lectura y escritura solo en él |

- **Restaurar una copia** (en una base de datos nueva, nunca encima de producción sin pensarlo dos veces):
  1. Descargar el archivo `doctrader-AAAA-MM-DD.dump.gpg` desde el depósito de R2.
  2. `gpg --decrypt doctrader-AAAA-MM-DD.dump.gpg > doctrader.dump` (pide la frase).
  3. `pg_restore --no-owner --no-privileges -d <url-de-la-base-nueva> doctrader.dump`.
  4. Apuntar `DATABASE_URL` de la API y el worker a la base restaurada solo después de revisarla.

### Limpieza antes del lanzamiento

Los clientes de hoy son de prueba. Antes de abrir, en el servicio de la API de Railway (pestaña de la consola o
`railway ssh`):

1. `node apps/api/dist/database/limpiar.js` muestra lo que se borraría, sin cambiar nada.
2. `CONFIRMAR_LIMPIEZA=borrar-todos-los-clientes node apps/api/dist/database/limpiar.js` borra todos los clientes con
   sus cuentas, licencias, órdenes, tickets, adjuntos y correos, y reinicia los números de orden (DTP-000001) y de
   ticket (1000). Quedan los admins, el socio, los ajustes, los planes, las direcciones de depósito, los textos
   legales, las preguntas y las respuestas guardadas. La auditoría no se toca (no admite borrados).
3. Vaciar el depósito de adjuntos (`doctrader-adjuntos`) en Cloudflare R2: todos sus archivos eran de prueba.

### Dónde está corriendo (2026-10-14)

| Pieza | Dirección |
|---|---|
| Web (Vercel, proyecto `doc_trader_pro`) | https://doctraderpro-khaki.vercel.app |
| API (Railway, proyecto `happy-adventure`) | https://doctraderapi-production.up.railway.app (`/salud`) |
| Worker (Railway) | Sin dominio; su latido se ve en `/salud` de la API |

**Lo que aprendimos al configurar Railway:**
- **Railway ya no aplica los archivos `railway.json`** ("Config as Code" quedó obsoleto; ahora es `.railway/railway.ts`).
  Los de `apps/api/railway/` quedan solo como referencia: la configuración real se pone en **Settings** de cada
  servicio (2026-10-15):

  | | API (`@doctrader/api`) | Worker |
  |---|---|---|
  | Build Command | `pnpm install --frozen-lockfile && pnpm --filter @doctrader/api build` | igual |
  | Start Command | `node apps/api/dist/main.js` | `node apps/api/dist/worker.js` |
  | Pre-deploy Command | `node apps/api/dist/database/preparar-despliegue.js` (migraciones y semilla) | — |
  | Healthcheck Path | `/salud` | — |
  | Restart Policy | On failure | Always |
  | Watch Paths | `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml` | igual |

  Sin el pre-deploy, la base de datos queda vacía y la API responde 500 ("relation users does not exist"). Sin el
  build command, Railway compila todo el monorepo (incluida la web) y la compilación puede tardar 12 minutos y caerse.
- "Redeploy" de un despliegue viejo usa la configuración de ese momento: después de cambiar Settings hay que hacer un
  despliegue nuevo del último commit.
- Al importar el repositorio, Railway crea un servicio por paquete del monorepo. Solo se dejan la API y el worker.
- **Root Directory vacío** en los dos servicios.
- La ruta del archivo de configuración **lleva barra inicial** (`/apps/api/railway/api.json`); los comandos **no**
  (`node apps/api/dist/worker.js`): el código vive en la carpeta de trabajo del contenedor, no en la raíz.
