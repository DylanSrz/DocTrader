import type { DataSourceOptions } from 'typeorm';
import { ENTIDADES } from './entidades/index.js';
import { Inicial1792000000000 } from './migraciones/1792000000000-inicial.js';
import { CuentasYAcceso1792100000000 } from './migraciones/1792100000000-cuentas-y-acceso.js';
import { PaginaPublica1792200000000 } from './migraciones/1792200000000-pagina-publica.js';
import { LicenciasYOrdenes1792300000000 } from './migraciones/1792300000000-licencias-y-ordenes.js';
import { PlanesYMarca1792400000000 } from './migraciones/1792400000000-planes-y-marca.js';
import { OperacionAdmin1792500000000 } from './migraciones/1792500000000-operacion-admin.js';
import { LicenciaDePrueba1792600000000 } from './migraciones/1792600000000-licencia-de-prueba.js';
import { Soporte1792700000000 } from './migraciones/1792700000000-soporte.js';
import { QuitarPrueba1792800000000 } from './migraciones/1792800000000-quitar-prueba.js';
import { Socio1792900000000 } from './migraciones/1792900000000-socio.js';
import { EliminarClientes1793000000000 } from './migraciones/1793000000000-eliminar-clientes.js';
import { DocumentosYMontos1793100000000 } from './migraciones/1793100000000-documentos-y-montos.js';

export const MIGRACIONES = [
  Inicial1792000000000,
  CuentasYAcceso1792100000000,
  PaginaPublica1792200000000,
  LicenciasYOrdenes1792300000000,
  PlanesYMarca1792400000000,
  OperacionAdmin1792500000000,
  LicenciaDePrueba1792600000000,
  Soporte1792700000000,
  QuitarPrueba1792800000000,
  Socio1792900000000,
  EliminarClientes1793000000000,
  DocumentosYMontos1793100000000,
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
