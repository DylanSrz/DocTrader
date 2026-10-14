import 'reflect-metadata';
import { CODIGO_PLAN } from '@doctrader/shared';
import { DataSource } from 'typeorm';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { opcionesBaseDeDatos } from './data-source.js';
import { Plan } from './entidades/index.js';
import { aplicarSemilla } from './semilla-datos.js';

/**
 * Paso previo a cada despliegue de la API (Railway `preDeployCommand`): aplica las migraciones pendientes y luego la
 * semilla, que no repite ni pisa nada. Un solo comando, sin depender de que el proveedor lo corra en una shell.
 */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const fuente = new DataSource(opcionesBaseDeDatos(entorno.DATABASE_URL, entorno.DATABASE_SSL));
await fuente.initialize();
try {
  const migraciones = await fuente.runMigrations({ transaction: 'each' });
  console.log(
    migraciones.length
      ? `Migraciones aplicadas: ${migraciones.map((m) => m.name).join(', ')}`
      : 'Migraciones: la base de datos ya estaba al día.',
  );
  const creado = await aplicarSemilla(fuente, Buffer.from(entorno.AUDIT_HMAC_KEY, 'base64'));
  console.log(creado.length ? `Semilla: ${creado.join(', ')}` : 'Semilla: nada nuevo.');
  const planes = await fuente.getRepository(Plan).count();
  if (planes < Object.keys(CODIGO_PLAN).length)
    throw new Error('Faltan planes después de la semilla');
} finally {
  await fuente.destroy();
}
