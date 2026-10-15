/**
 * Control de la prueba (`docs/CONTEXTO.md`, "Control de la prueba"): qué bloquea una solicitud, qué solo se le
 * muestra al admin y cómo se comparan los datos. Las huellas se calculan en la API con su propia llave (HMAC).
 */

export const TIPO_HUELLA = {
  CEDULA: 'CEDULA',
  CUENTA: 'CUENTA',
  CORREO: 'CORREO',
  TELEFONO: 'TELEFONO',
  NUMERO_CUENTA: 'NUMERO_CUENTA',
  DISPOSITIVO: 'DISPOSITIVO',
  BILLETERA: 'BILLETERA',
} as const;
export type TipoHuella = (typeof TIPO_HUELLA)[keyof typeof TIPO_HUELLA];

/** Las huellas que bloquean una solicitud. Las demás son señales para el admin. */
export const HUELLAS_QUE_BLOQUEAN: readonly TipoHuella[] = [
  TIPO_HUELLA.CEDULA,
  TIPO_HUELLA.CUENTA,
  TIPO_HUELLA.CORREO,
  TIPO_HUELLA.TELEFONO,
];

/** Lo que ve el cliente cuando su solicitud se bloquea. No dice qué prueba anterior coincidió. */
export const MOTIVO_BLOQUEO: Record<'CEDULA' | 'CUENTA' | 'CORREO' | 'TELEFONO', string> = {
  CEDULA: 'Tu cédula ya tuvo una prueba.',
  CUENTA: 'Esta cuenta de trading ya tuvo una prueba.',
  CORREO: 'Tu correo ya está ligado a una prueba.',
  TELEFONO: 'Tu teléfono ya está ligado a una prueba.',
};

/** Largo del motivo con que el admin rechaza una solicitud (le llega al cliente por correo). */
export const LIMITES_PRUEBA = { motivoRechazo: { minimo: 5, maximo: 300 } } as const;

/** Minúsculas, sin tildes ni signos, palabras en orden: "Gómez  Restrepo, Laura" → "gomez laura restrepo". */
function palabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(' ')
    .filter((p) => p.length > 1);
}

/**
 * Señal "titular parecido": dos nombres comparten al menos dos palabras, o casi todas las del más corto. Es una
 * señal para el admin, no un bloqueo: familiares comparten apellidos.
 */
export function titularParecido(a: string, b: string): boolean {
  const pa = new Set(palabras(a));
  const pb = new Set(palabras(b));
  if (pa.size === 0 || pb.size === 0) return false;
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  return comunes >= Math.min(2, pa.size, pb.size);
}

/** Distancia de edición con transposiciones (dos dígitos cambiados de lugar cuentan como uno). */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Señal "número de cuenta parecido": dos números distintos de 6 o más dígitos a una o dos ediciones (7718260 y
 * 7718206). Los números cortos se parecen por azar.
 */
export function numeroParecido(a: string, b: string): boolean {
  if (a === b || a.length < 6 || b.length < 6) return false;
  return distancia(a, b) <= Math.min(2, Math.floor(Math.min(a.length, b.length) / 4));
}
