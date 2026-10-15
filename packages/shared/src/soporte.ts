/**
 * Soporte por tickets (`docs/CONTEXTO.md`, "Registro y soporte", y `docs/MODELO-DATOS.md` §3.6 y §4.5). Lo usan la
 * API (validación) y la web (formularios y textos), para que las reglas sean las mismas en los dos lados.
 */

export const TEMA_TICKET = {
  PAGOS: 'PAGOS',
  CONEXION: 'CONEXION',
  LICENCIA: 'LICENCIA',
  TECNICO: 'TECNICO',
  OTRO: 'OTRO',
} as const;
export type TemaTicket = (typeof TEMA_TICKET)[keyof typeof TEMA_TICKET];

export const NOMBRE_TEMA: Record<TemaTicket, string> = {
  PAGOS: 'Pagos',
  CONEXION: 'Conexión de la cuenta',
  LICENCIA: 'Licencia',
  TECNICO: 'Problema técnico',
  OTRO: 'Otro',
};

export const PRIORIDAD_TICKET = { NORMAL: 'NORMAL', ALTA: 'ALTA' } as const;
export type PrioridadTicket = (typeof PRIORIDAD_TICKET)[keyof typeof PRIORIDAD_TICKET];

/** Largo de los textos de soporte. Los mensajes son texto plano: nunca se muestran como HTML. */
export const LIMITES_TICKET = {
  asunto: { minimo: 5, maximo: 120 },
  /** El primer mensaje: que cuente qué pasa. */
  primerMensaje: { minimo: 10, maximo: 5000 },
  mensaje: { minimo: 1, maximo: 5000 },
  respuestaGuardada: { titulo: { minimo: 3, maximo: 60 }, cuerpo: { minimo: 10, maximo: 3000 } },
  respuestasGuardadas: 40,
  /** Tickets abiertos o respondidos que puede tener un cliente al mismo tiempo. */
  abiertosPorCliente: 10,
  /** Un ticket resuelto se cierra solo después de estos días (ajuste `tickets.auto_close_days`). */
  diasCierre: { minimo: 1, maximo: 60 },
} as const;

/** Adjuntos: imágenes o PDF, hasta 5 por mensaje y 10 MB cada uno (`docs/SEGURIDAD.md` §7). */
export const TIPO_ADJUNTO = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  PDF: 'application/pdf',
} as const;
export type TipoAdjunto = (typeof TIPO_ADJUNTO)[keyof typeof TIPO_ADJUNTO];

export const LIMITES_ADJUNTO = {
  porMensaje: 5,
  maximoBytes: 10 * 1024 * 1024,
  /** Para el selector de archivos del navegador. El tipo real se comprueba por el contenido. */
  aceptar: 'image/jpeg,image/png,image/webp,application/pdf',
} as const;

const EXTENSION: Record<TipoAdjunto, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * El tipo de un archivo por sus primeros bytes, no por su nombre ni por lo que diga el navegador. `null` si no es
 * una imagen JPG, PNG o WEBP, ni un PDF.
 */
export function tipoPorContenido(bytes: Uint8Array): TipoAdjunto | null {
  const empieza = (firma: number[], desde = 0) =>
    bytes.length >= desde + firma.length && firma.every((b, i) => bytes[desde + i] === b);
  if (empieza([0xff, 0xd8, 0xff])) return TIPO_ADJUNTO.JPEG;
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TIPO_ADJUNTO.PNG;
  // RIFF....WEBP
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) {
    return TIPO_ADJUNTO.WEBP;
  }
  if (empieza([0x25, 0x50, 0x44, 0x46, 0x2d])) return TIPO_ADJUNTO.PDF; // %PDF-
  return null;
}

/**
 * Nombre que se muestra de un adjunto: sin rutas ni caracteres de control, de largo razonable y con la extensión
 * de su tipo real. En el almacenamiento el archivo se guarda con un nombre aleatorio.
 */
export function nombreDeAdjunto(nombre: string, tipo: TipoAdjunto): string {
  const base =
    nombre
      .split(/[\\/]/)
      .pop()!
      // Caracteres de control y los que confunden a los sistemas de archivos o a los encabezados.
      .replace(/[\p{Cc}\p{Cf}"<>:|?*]+/gu, '')
      .replace(/\.[a-z0-9]{1,5}$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'adjunto';
  return `${base}.${EXTENSION[tipo]}`;
}
