import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Cifrado por campo con AES-256-GCM (`docs/SEGURIDAD.md` §4). Formato del dato guardado:
 * `[versión de la llave: 1 byte][iv: 12 bytes][etiqueta: 16 bytes][texto cifrado]`.
 *
 * El `contexto` (por ejemplo `users.cedula`) va como dato autenticado: un valor cifrado para un campo no se
 * puede copiar a otro campo y descifrarse allí.
 */
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;

export function cifrar(llave: Buffer, version: number, dato: string | Buffer, contexto: string) {
  const iv = randomBytes(LARGO_IV);
  const cifrador = createCipheriv('aes-256-gcm', llave, iv);
  cifrador.setAAD(Buffer.from(contexto, 'utf8'));
  const cifrado = Buffer.concat([cifrador.update(dato), cifrador.final()]);
  return Buffer.concat([Buffer.from([version]), iv, cifrador.getAuthTag(), cifrado]);
}

/** Descifra con la llave de la versión que dice el dato. Si alguien alteró el dato, lanza un error. */
export function descifrar(llaves: ReadonlyMap<number, Buffer>, dato: Buffer, contexto: string) {
  const version = dato[0];
  const llave = version === undefined ? undefined : llaves.get(version);
  if (!llave) throw new Error(`No hay llave de cifrado para la versión ${version}`);
  const iv = dato.subarray(1, 1 + LARGO_IV);
  const etiqueta = dato.subarray(1 + LARGO_IV, 1 + LARGO_IV + LARGO_ETIQUETA);
  const descifrador = createDecipheriv('aes-256-gcm', llave, iv);
  descifrador.setAAD(Buffer.from(contexto, 'utf8'));
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([
    descifrador.update(dato.subarray(1 + LARGO_IV + LARGO_ETIQUETA)),
    descifrador.final(),
  ]);
}

/**
 * Las llaves de cifrado del entorno: la actual con su versión y, durante una rotación, la anterior (versión - 1),
 * que solo sirve para leer. `docs/ROTACION-CREDENCIALES.md`.
 */
export function llavesDeCifrado(entorno: {
  DATA_ENCRYPTION_KEY: string;
  DATA_ENCRYPTION_KEY_VERSION: number;
  DATA_ENCRYPTION_KEY_ANTERIOR?: string | undefined;
}): { version: number; llaves: Map<number, Buffer> } {
  const version = entorno.DATA_ENCRYPTION_KEY_VERSION;
  const llaves = new Map([[version, Buffer.from(entorno.DATA_ENCRYPTION_KEY, 'base64')]]);
  if (entorno.DATA_ENCRYPTION_KEY_ANTERIOR) {
    llaves.set(version - 1, Buffer.from(entorno.DATA_ENCRYPTION_KEY_ANTERIOR, 'base64'));
  }
  return { version, llaves };
}

/** HMAC-SHA256 separado por propósito, para buscar un dato sin guardarlo en claro. */
export function huella(llave: Buffer, proposito: string, valor: string): Buffer {
  return createHmac('sha256', llave).update(proposito).update('\0').update(valor).digest();
}

/** Secreto aleatorio para enlaces de un solo uso y sesiones: 32 bytes en base64url (sin caracteres raros). */
export function secretoAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
