import 'reflect-metadata';
import { CODIGO_PLAN } from '@doctrader/shared';
import { registrarEnCadena } from '../auditoria/cadena.js';
import { cargarEntornoLocal } from '../config/cargar-entorno-local.js';
import { validarEntorno } from '../config/entorno.js';
import { llavesDeCifrado } from '../seguridad/cifrado.js';
import { recifrarDatos } from '../seguridad/recifrado.js';
import { Plan } from './entidades/index.js';
import { conectarRotandoContrasena } from './rotacion.js';
import { aplicarSemilla } from './semilla-datos.js';

/**
 * Paso previo a cada despliegue de la API (Railway `preDeployCommand`): aplica las migraciones pendientes y luego la
 * semilla, que no repite ni pisa nada. Un solo comando, sin depender de que el proveedor lo corra en una shell.
 *
 * Durante una rotación de credenciales (`docs/ROTACION-CREDENCIALES.md`) también:
 * - con `CONTRASENA_DB_ANTERIOR`, cambia la contraseña de la base de datos por la que ya tiene `DATABASE_URL`;
 * - con `DATA_ENCRYPTION_KEY_ANTERIOR`, vuelve a cifrar con la llave actual lo que siga cifrado con la anterior.
 */
cargarEntornoLocal();
const entorno = validarEntorno(process.env);
const llaveAuditoria = Buffer.from(entorno.AUDIT_HMAC_KEY, 'base64');
const { fuente, contrasenaCambiada } = await conectarRotandoContrasena(
  entorno.DATABASE_URL,
  entorno.DATABASE_SSL,
  entorno.CONTRASENA_DB_ANTERIOR,
  llaveAuditoria,
);
try {
  if (entorno.CONTRASENA_DB_ANTERIOR) {
    console.log(
      contrasenaCambiada
        ? 'Base de datos: contraseña cambiada por la nueva de las variables de Postgres.'
        : 'Base de datos: ya se conecta con la contraseña nueva. Ya se puede quitar CONTRASENA_DB_ANTERIOR.',
    );
  }

  const migraciones = await fuente.runMigrations({ transaction: 'each' });
  console.log(
    migraciones.length
      ? `Migraciones aplicadas: ${migraciones.map((m) => m.name).join(', ')}`
      : 'Migraciones: la base de datos ya estaba al día.',
  );
  const creado = await aplicarSemilla(fuente, llaveAuditoria);
  console.log(creado.length ? `Semilla: ${creado.join(', ')}` : 'Semilla: nada nuevo.');
  const planes = await fuente.getRepository(Plan).count();
  if (planes < Object.keys(CODIGO_PLAN).length)
    throw new Error('Faltan planes después de la semilla');

  if (entorno.DATA_ENCRYPTION_KEY_ANTERIOR) {
    const { version, llaves } = llavesDeCifrado(entorno);
    const conteo = await fuente.transaction(async (m) => {
      const hecho = await recifrarDatos(m, version, llaves);
      if (Object.keys(hecho).length) {
        await registrarEnCadena(m, llaveAuditoria, {
          actorRole: 'SISTEMA',
          action: 'seguridad.datos_recifrados',
          metadata: { version, filas: hecho },
        });
      }
      return hecho;
    });
    const detalle = Object.entries(conteo).map(([c, n]) => `${c}: ${n}`);
    console.log(
      detalle.length
        ? `Cifrado: datos vueltos a cifrar con la llave versión ${version} (${detalle.join(', ')}).`
        : `Cifrado: todo ya está con la llave versión ${version}. Ya se puede quitar DATA_ENCRYPTION_KEY_ANTERIOR.`,
    );
  }
} finally {
  await fuente.destroy();
}
