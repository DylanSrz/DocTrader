import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { opcionesBaseDeDatos } from '../src/database/data-source.js';
import { aplicarSemilla } from '../src/database/semilla-datos.js';

const URL_PRUEBAS =
  process.env.TEST_DATABASE_URL ?? 'postgres://doctrader:doctrader@localhost:5432/doctrader_test';

/** Antes de las pruebas: base de datos vacía, todas las migraciones y la semilla, como en un despliegue nuevo. */
export async function setup(): Promise<void> {
  if (!/_test(\?|$)/.test(new URL(URL_PRUEBAS).pathname + new URL(URL_PRUEBAS).search)) {
    throw new Error(
      `Por seguridad, las pruebas solo borran bases de datos que terminan en _test: ${URL_PRUEBAS}`,
    );
  }
  const fuente = new DataSource(opcionesBaseDeDatos(URL_PRUEBAS, false));
  await fuente.initialize();
  try {
    await fuente.query('DROP SCHEMA public CASCADE');
    await fuente.query('CREATE SCHEMA public');
    await fuente.runMigrations({ transaction: 'each' });
    await aplicarSemilla(fuente, Buffer.alloc(32, 42));
  } finally {
    await fuente.destroy();
  }
}
