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

Se configura cuando estén creadas las cuentas (ver `docs/PENDIENTES.md`). No hay Docker en producción.

- **Web — Vercel:** proyecto con raíz `apps/web` (Vercel detecta pnpm y el monorepo). Variables:
  `NEXT_PUBLIC_API_URL=https://api.doctraderpro.com`. Dominio `doctraderpro.com` y `www`.
- **API y worker — Railway:** dos servicios del mismo repositorio, con los archivos de configuración
  `apps/api/railway/api.json` y `apps/api/railway/worker.json`. Las migraciones corren solas antes de cada despliegue
  de la API. Variables: las de `apps/api/.env.example` con valores de producción (`NODE_ENV=production`,
  `WEB_ORIGIN=https://doctraderpro.com`, `DATABASE_URL` y `REDIS_URL` de Railway, y una `AUDIT_HMAC_KEY` nueva guardada
  en el gestor de contraseñas). La semilla se corre una vez: `node apps/api/dist/database/semilla.js`.
- **Integración continua:** (los flujos están en `docs/ci/` hasta que se copien a `.github/workflows/`; ver ese README) GitHub Actions corre formato, lint, tipos, pruebas unitarias, pruebas de punta a punta,
  build, búsqueda de secretos (gitleaks) y CodeQL en cada pull request. Dependabot propone actualizaciones cada semana.
