import 'reflect-metadata';
import { CODIGO_PLAN } from '@doctrader/shared';
import { DataSource } from 'typeorm';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { opcionesBaseDeDatos } from './data-source.js';
import { Plan } from './entidades/index.js';
import { aplicarSemilla } from './semilla-datos.js';

/** Carga los datos iniciales. Se puede correr varias veces sin pisar lo que se cambió desde el panel. */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const fuente = new DataSource(opcionesBaseDeDatos(entorno.DATABASE_URL, entorno.DATABASE_SSL));
await fuente.initialize();
try {
  const creado = await aplicarSemilla(fuente, Buffer.from(entorno.AUDIT_HMAC_KEY, 'base64'));
  console.log(
    creado.length
      ? `Semilla aplicada:\n  - ${creado.join('\n  - ')}`
      : 'Nada nuevo: la semilla ya estaba aplicada.',
  );
  const planes = await fuente.getRepository(Plan).count();
  if (planes < Object.keys(CODIGO_PLAN).length)
    throw new Error('Faltan planes después de la semilla');
} finally {
  await fuente.destroy();
}
