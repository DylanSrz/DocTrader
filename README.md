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
cp apps/api/.env.example apps/api/.env # y pon una llave en AUDIT_HMAC_KEY: openssl rand -base64 32
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrar                         # crea las tablas
pnpm db:semilla                        # planes, ajustes, direcciones de depósito y los dos admins
pnpm dev                               # web en localhost:3000, API en localhost:4000
pnpm --filter @doctrader/api dev:worker  # el worker, en otra terminal
```

- `localhost:4000/salud` dice si la API ve la base de datos y Redis, y cuándo fue el último latido del worker.
- `localhost:3000/sistema` muestra el sistema de diseño (no existe en producción).

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

## Despliegue

No hay Docker en producción. Las cuentas de Vercel y Railway están a nombre de Dylan (2026-10-14).

### Web — Vercel

1. **Add New → Project** → importar `DylanSrz/DocTrader`.
2. **Root Directory:** `apps/web`. Vercel detecta Next.js y pnpm; el comando de build está en `apps/web/vercel.json`
   (compila primero `packages/shared`).
3. Variables: `NEXT_PUBLIC_API_URL` = el dominio de la API en Railway (y más adelante `https://api.doctraderpro.com`).
   En el entorno *Preview*, `MOSTRAR_SISTEMA=true` para ver `/sistema`.
4. El dominio `doctraderpro.com` se conecta cuando la landing esté lista (etapa 2), no antes.

### API y worker — Railway

1. **New Project → Deploy from GitHub repo** → `DylanSrz/DocTrader`. Ese primer servicio es la **API**:
   - Settings → **Config-as-code**: `apps/api/railway/api.json` (build, arranque, `/salud` y, antes de cada
     despliegue, migraciones y semilla; la semilla no repite ni pisa nada).
   - Settings → Networking → **Generate Domain** (después, `api.doctraderpro.com`).
2. En el mismo proyecto: **New → Database → PostgreSQL** y **New → Database → Redis**.
3. **New → GitHub repo** otra vez, mismo repositorio: es el **worker**. Config-as-code:
   `apps/api/railway/worker.json`. No necesita dominio.
4. Variables, en la API y en el worker (iguales en los dos):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (red privada de Railway) |
   | `DATABASE_SSL` | `false` (la red privada no usa SSL) |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `WEB_ORIGIN` | El dominio de Vercel (después, `https://doctraderpro.com`) |
   | `AUDIT_HMAC_KEY` | Una llave nueva: `openssl rand -base64 32`. Guárdala en el gestor de contraseñas: si se pierde, la auditoría vieja ya no se puede verificar |

5. Revisar `https://<dominio-de-la-api>/salud`: debe responder `"estado":"ok"` y, al minuto, mostrar el latido del
   worker.

### Integración continua

GitHub Actions (`.github/workflows/`) corre formato, lint, tipos, pruebas unitarias, pruebas de punta a punta,
build, búsqueda de secretos (gitleaks) y CodeQL en cada pull request. Dependabot propone actualizaciones cada semana.

### Dónde está corriendo (2026-10-14)

| Pieza | Dirección |
|---|---|
| Web (Vercel, proyecto `doc_trader_pro`) | https://doctraderpro-khaki.vercel.app |
| API (Railway, proyecto `happy-adventure`) | https://doctraderapi-production.up.railway.app (`/salud`) |
| Worker (Railway) | Sin dominio; su latido se ve en `/salud` de la API |

**Lo que aprendimos al configurar Railway:**
- Al importar el repositorio, Railway crea un servicio por paquete del monorepo. Solo se dejan la API y el worker.
- **Root Directory vacío** en los dos servicios.
- La ruta del archivo de configuración **lleva barra inicial** (`/apps/api/railway/api.json`); los comandos **no**
  (`node apps/api/dist/worker.js`): el código vive en la carpeta de trabajo del contenedor, no en la raíz.
