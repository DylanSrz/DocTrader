import type { EntityManager } from 'typeorm';
import { cifrar, descifrar } from './cifrado.js';

/**
 * Las columnas cifradas y su contexto (el mismo que usa cada servicio al cifrar). Si se agrega una columna cifrada,
 * va aquí también: `recifrado.spec.ts` compara esta lista con los contextos de los servicios.
 */
export const COLUMNAS_CIFRADAS = [
  { tabla: 'users', columna: 'cedula_enc', contexto: 'users.cedula' },
  { tabla: 'users', columna: 'totp_secret_enc', contexto: 'users.totp' },
  {
    tabla: 'trading_accounts',
    columna: 'master_password_enc',
    contexto: 'trading_accounts.master_password',
  },
  {
    tabla: 'trading_accounts',
    columna: 'investor_password_enc',
    contexto: 'trading_accounts.investor_password',
  },
  { tabla: 'notifications', columna: 'secret_enc', contexto: 'notifications.secret' },
] as const;

/** Cuántas filas se volvieron a cifrar, por `tabla.columna`. */
export type ConteoRecifrado = Record<string, number>;

/**
 * Vuelve a cifrar con la llave actual todo lo que esté cifrado con otra versión (rotación de
 * `DATA_ENCRYPTION_KEY`, `docs/ROTACION-CREDENCIALES.md`). Corre dentro de la transacción de quien llama: si un
 * dato no se puede leer con ninguna de las llaves, falla y no cambia nada. Se puede repetir: lo que ya está en la
 * versión actual no se toca.
 */
export async function recifrarDatos(
  m: EntityManager,
  version: number,
  llaves: ReadonlyMap<number, Buffer>,
): Promise<ConteoRecifrado> {
  const llave = llaves.get(version);
  if (!llave) throw new Error(`No hay llave de cifrado para la versión actual (${version})`);
  const conteo: ConteoRecifrado = {};
  for (const { tabla, columna, contexto } of COLUMNAS_CIFRADAS) {
    const filas = (await m.query(
      `SELECT id, ${columna} AS dato FROM ${tabla}
        WHERE ${columna} IS NOT NULL AND get_byte(${columna}, 0) <> $1`,
      [version],
    )) as { id: string; dato: Buffer }[];
    for (const { id, dato } of filas) {
      const claro = descifrar(llaves, dato, contexto);
      await m.query(`UPDATE ${tabla} SET ${columna} = $1 WHERE id = $2`, [
        cifrar(llave, version, claro, contexto),
        id,
      ]);
    }
    if (filas.length) conteo[`${tabla}.${columna}`] = filas.length;
  }
  return conteo;
}
