import { defineConfig } from 'vitest/config';

/**
 * Pruebas de punta a punta contra Postgres y Redis reales (los de docker/compose.yml en desarrollo y los
 * servicios de GitHub Actions en la integración continua). Usan una base de datos aparte, que se reinicia.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/preparar-base.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://doctrader:doctrader@localhost:5432/doctrader_test',
      DATABASE_SSL: 'false',
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
      WEB_ORIGIN: 'http://localhost:3000',
      AUDIT_HMAC_KEY: Buffer.alloc(32, 42).toString('base64'),
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 43).toString('base64'),
      LOOKUP_HMAC_KEY: Buffer.alloc(32, 44).toString('base64'),
      TRIAL_HMAC_KEY: Buffer.alloc(32, 45).toString('base64'),
      PROXY_SECRET: 'secreto-de-pruebas-de-la-web-0123456789',
      HIBP_ACTIVO: 'false',
    },
  },
});
