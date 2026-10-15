import type { DataSourceOptions } from 'typeorm';
import { ENTIDADES } from './entidades/index.js';
import { Inicial1792000000000 } from './migraciones/1792000000000-inicial.js';
import { CuentasYAcceso1792100000000 } from './migraciones/1792100000000-cuentas-y-acceso.js';
import { PaginaPublica1792200000000 } from './migraciones/1792200000000-pagina-publica.js';

export const MIGRACIONES = [
  Inicial1792000000000,
  CuentasYAcceso1792100000000,
  PaginaPublica1792200000000,
];

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
