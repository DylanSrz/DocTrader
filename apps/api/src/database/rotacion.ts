import { DataSource } from 'typeorm';
import { registrarEnCadena } from '../auditoria/cadena.js';
import { opcionesBaseDeDatos } from './data-source.js';

/** Código de Postgres para "contraseña incorrecta". */
const CONTRASENA_INCORRECTA = '28P01';

/**
 * Se conecta a la base de datos con `DATABASE_URL`. Durante una rotación de la contraseña (`docs/ROTACION-CREDENCIALES.md`),
 * Postgres ya tiene la nueva en sus variables pero la base todavía espera la vieja: si la conexión falla por contraseña
 * y hay `contrasenaAnterior`, entra con la vieja, cambia la contraseña por la de `DATABASE_URL`, lo deja en la
 * auditoría y vuelve a conectarse con la nueva. Nunca escribe una contraseña en el registro.
 */
export async function conectarRotandoContrasena(
  url: string,
  ssl: boolean,
  contrasenaAnterior: string | undefined,
  llaveAuditoria: Buffer,
): Promise<{ fuente: DataSource; contrasenaCambiada: boolean }> {
  const conectar = async (direccion: string) => {
    const fuente = new DataSource(opcionesBaseDeDatos(direccion, ssl));
    await fuente.initialize();
    return fuente;
  };
  try {
    return { fuente: await conectar(url), contrasenaCambiada: false };
  } catch (error) {
    if (!contrasenaAnterior || (error as { code?: string }).code !== CONTRASENA_INCORRECTA)
      throw error;
  }
  const conLaAnterior = new URL(url);
  conLaAnterior.password = encodeURIComponent(contrasenaAnterior);
  const vieja = await conectar(conLaAnterior.toString());
  try {
    await cambiarContrasenaDb(vieja, decodeURIComponent(new URL(url).password), llaveAuditoria);
  } finally {
    await vieja.destroy();
  }
  return { fuente: await conectar(url), contrasenaCambiada: true };
}

/** Cambia la contraseña del usuario de la conexión y lo deja en la auditoría. */
export async function cambiarContrasenaDb(
  fuente: DataSource,
  nueva: string,
  llaveAuditoria: Buffer,
): Promise<void> {
  await fuente.transaction(async (m) => {
    // `ALTER ROLE` no acepta parámetros: `format` con %I y %L escapa el nombre y la contraseña.
    const [{ sentencia }] = (await m.query(
      `SELECT format('ALTER ROLE %I WITH PASSWORD %L', current_user, $1::text) AS sentencia`,
      [nueva],
    )) as [{ sentencia: string }];
    await m.query(sentencia);
    await registrarEnCadena(m, llaveAuditoria, {
      actorRole: 'SISTEMA',
      action: 'seguridad.contrasena_db_cambiada',
    });
  });
}
