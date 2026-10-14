import type { DataSourceOptions } from 'typeorm';
import { ENTIDADES } from './entidades/index.js';
import { Inicial1792000000000 } from './migraciones/1792000000000-inicial.js';

export const MIGRACIONES = [Inicial1792000000000];

/** Opciones de la base de datos, compartidas por la API, el worker y los scripts de migración y semilla. */
export function opcionesBaseDeDatos(url: string, ssl: boolean): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    ssl: ssl ? { rejectUnauthorized: true } : false,
    entities: ENTIDADES,
    migrations: MIGRACIONES,
    migrationsTableName: 'migraciones',
    // El esquema solo cambia con migraciones revisadas, nunca solo.
    synchronize: false,
    migrationsRun: false,
  };
}
