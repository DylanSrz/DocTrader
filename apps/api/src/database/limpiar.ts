import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { opcionesBaseDeDatos } from './data-source.js';
import { FRASE_LIMPIEZA, limpiarParaLanzamiento } from './limpieza-lanzamiento.js';

/**
 * Limpieza de la base de datos antes del lanzamiento. Se corre a mano en el servicio de la API de Railway (ver
 * el README). Sin la frase en `CONFIRMAR_LIMPIEZA` solo muestra lo que borraría; con ella borra una
 * sola vez.
 */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const confirmar = process.env.CONFIRMAR_LIMPIEZA === FRASE_LIMPIEZA;
const fuente = new DataSource(opcionesBaseDeDatos(entorno.DATABASE_URL, entorno.DATABASE_SSL));
await fuente.initialize();
try {
  const { borrado, quedan } = await fuente.transaction((m) => limpiarParaLanzamiento(m, confirmar));
  console.log(confirmar ? 'Se borró:' : 'Esto se borraría (no se cambió nada):');
  for (const [tabla, n] of Object.entries(borrado)) console.log(`  - ${tabla}: ${n}`);
  console.log(
    `${confirmar ? 'Quedan' : 'Hoy hay'}: ${quedan.ADMIN ?? 0} admins y ${quedan.CLIENT ?? 0} clientes.`,
  );
  if (confirmar) {
    console.log(
      borrado.files
        ? 'Listo. Falta vaciar el depósito de adjuntos en Cloudflare R2: todos sus archivos eran de prueba.'
        : 'Listo. No había adjuntos: el depósito de Cloudflare R2 no se toca.',
    );
  } else {
    console.log(`Para borrar de verdad: CONFIRMAR_LIMPIEZA=${FRASE_LIMPIEZA}`);
  }
} finally {
  await fuente.destroy();
}
