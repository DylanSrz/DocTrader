import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { opcionesBaseDeDatos } from './data-source.js';
import { FRASE_LIMPIEZA, limpiarParaLanzamiento } from './limpieza-lanzamiento.js';

/**
 * Limpieza de la base de datos antes del lanzamiento. Se corre una sola vez, a mano, en el servicio de la API de
 * Railway: `node apps/api/dist/database/limpiar.js`. Sin la frase en `CONFIRMAR_LIMPIEZA` solo muestra lo que
 * borraría.
 */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const confirmar = process.env.CONFIRMAR_LIMPIEZA === FRASE_LIMPIEZA;
const fuente = new DataSource(opcionesBaseDeDatos(entorno.DATABASE_URL, entorno.DATABASE_SSL));
await fuente.initialize();
try {
  const conteo = await limpiarParaLanzamiento(fuente, confirmar);
  console.log(confirmar ? 'Se borró:' : 'Esto se borraría (no se cambió nada):');
  for (const [tabla, n] of Object.entries(conteo)) console.log(`  - ${tabla}: ${n}`);
  if (confirmar) {
    console.log(
      'Listo. Falta vaciar el depósito de adjuntos en Cloudflare R2: todos sus archivos eran de prueba.',
    );
  } else {
    console.log(`Para borrar de verdad: CONFIRMAR_LIMPIEZA=${FRASE_LIMPIEZA}`);
  }
} finally {
  await fuente.destroy();
}
