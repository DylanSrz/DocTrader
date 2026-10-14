import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { opcionesBaseDeDatos } from './data-source.js';

/** Aplica las migraciones pendientes. En producción corre como paso aparte antes de cada despliegue. */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const fuente = new DataSource(opcionesBaseDeDatos(entorno.DATABASE_URL, entorno.DATABASE_SSL));
await fuente.initialize();
try {
  const aplicadas = await fuente.runMigrations({ transaction: 'each' });
  console.log(
    aplicadas.length
      ? `Migraciones aplicadas: ${aplicadas.map((m) => m.name).join(', ')}`
      : 'La base de datos ya estaba al día.',
  );
} finally {
  await fuente.destroy();
}
