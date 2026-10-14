import { existsSync } from 'node:fs';

/** En desarrollo lee `apps/api/.env`. En producción las variables vienen del proveedor y no hay archivo. */
export function cargarEntornoLocal(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
}
