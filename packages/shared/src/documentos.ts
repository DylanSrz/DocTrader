/**
 * Documentos de identidad del registro: país emisor, tipo y reglas del número. Es la única fuente para la web y la
 * API. Para admitir un país o un tipo nuevo basta con agregarlo aquí (ver `docs/DECISIONES-TECNICAS.md`, §6).
 *
 * Solo adultos: no se admite la tarjeta de identidad (TI) ni el registro civil. Las reglas son deliberadamente
 * amplias donde el formato oficial varía (licencias de EE. UU., pasaportes): rechazan caracteres que no van, pero no
 * un documento legítimo con otro largo.
 */

export const TIPO_DOCUMENTO = {
  CC: 'CC',
  CE: 'CE',
  PA: 'PA',
  PPT: 'PPT',
  PEP: 'PEP',
  CD: 'CD',
  SC: 'SC',
  DNI: 'DNI',
  INE: 'INE',
  CURP: 'CURP',
  LIC: 'LIC',
} as const;
export type TipoDocumento = (typeof TIPO_DOCUMENTO)[keyof typeof TIPO_DOCUMENTO];

interface Regla {
  nombre: string;
  /** Sobre el número ya en mayúsculas. */
  patron: RegExp;
  /** Cómo corregirlo, en una frase. */
  ayuda: string;
  /** Solo dígitos: el campo abre el teclado numérico. */
  numerico?: boolean;
}

const PASAPORTE: Regla = {
  nombre: 'Pasaporte',
  patron: /^[A-Z0-9]{5,20}$/,
  ayuda: 'Escribe el número del pasaporte con letras y números, sin espacios ni guiones.',
};

const NACIONAL: Regla = {
  nombre: 'Documento nacional de identidad',
  patron: /^[A-Z0-9]{4,20}$/,
  ayuda: 'Escribe el número del documento con letras y números, sin espacios, puntos ni guiones.',
};

/** Países con reglas propias. Los demás de `PAISES` usan pasaporte y documento nacional genéricos. */
const REGLAS_POR_PAIS: Partial<Record<string, Partial<Record<TipoDocumento, Regla>>>> = {
  CO: {
    CC: {
      nombre: 'Cédula de ciudadanía',
      patron: /^[1-9][0-9]{2,9}$/,
      ayuda: 'Escribe solo números, sin puntos, comas ni espacios (de 3 a 10 dígitos).',
      numerico: true,
    },
    CE: {
      nombre: 'Cédula de extranjería',
      patron: /^[0-9]{3,10}$/,
      ayuda: 'Escribe solo números, sin puntos, comas ni espacios (de 3 a 10 dígitos).',
      numerico: true,
    },
    PA: PASAPORTE,
    PPT: {
      nombre: 'Permiso por protección temporal (PPT)',
      patron: /^[0-9]{5,15}$/,
      ayuda: 'Escribe solo los números del permiso, sin espacios (de 5 a 15 dígitos).',
      numerico: true,
    },
    PEP: {
      nombre: 'Permiso especial de permanencia (PEP)',
      patron: /^[0-9]{6,15}$/,
      ayuda: 'Escribe solo los números del permiso, sin espacios (de 6 a 15 dígitos).',
      numerico: true,
    },
    CD: {
      nombre: 'Carné diplomático',
      patron: /^[A-Z0-9]{3,20}$/,
      ayuda: 'Escribe el número del carné con letras y números, sin espacios ni guiones.',
    },
    SC: {
      nombre: 'Salvoconducto',
      patron: /^[A-Z0-9]{3,20}$/,
      ayuda: 'Escribe el número del salvoconducto con letras y números, sin espacios ni guiones.',
    },
  },
  AR: {
    DNI: {
      nombre: 'DNI',
      patron: /^[0-9]{6,9}$/,
      ayuda: 'Escribe solo los números del DNI, sin puntos ni espacios.',
      numerico: true,
    },
    PA: PASAPORTE,
  },
  MX: {
    INE: {
      nombre: 'Credencial para votar (INE)',
      patron: /^[A-Z]{6}[0-9]{8}[HMX][0-9]{3}$/,
      ayuda:
        'Escribe la clave de elector: 18 caracteres, 6 letras, 8 números, H, M o X y 3 números.',
    },
    CURP: {
      nombre: 'CURP',
      patron: /^[A-Z]{4}[0-9]{6}[HMX][A-Z]{5}[A-Z0-9][0-9]$/,
      ayuda: 'Escribe la CURP completa: 18 letras y números, sin espacios.',
    },
    PA: PASAPORTE,
  },
  US: {
    PA: {
      nombre: 'Pasaporte',
      patron: /^([A-Z][0-9]{8}|[0-9]{9})$/,
      ayuda: 'El pasaporte de EE. UU. tiene 9 caracteres: una letra y 8 números, o 9 números.',
    },
    LIC: {
      nombre: 'Licencia de conducción o identificación estatal',
      patron: /^[A-Z0-9]{4,20}$/,
      ayuda: 'Escribe el número con letras y números, sin espacios ni guiones.',
    },
  },
  GB: {
    PA: {
      nombre: 'Pasaporte',
      patron: /^[A-Z0-9]{9}$/,
      ayuda: 'El pasaporte del Reino Unido tiene 9 caracteres, sin espacios.',
    },
    LIC: {
      nombre: 'Licencia de conducción (driving licence)',
      patron: /^([A-Z9]{5}[0-9]{6}[A-Z9]{2}[A-Z0-9][A-Z]{2}|[0-9]{8})$/,
      ayuda:
        'Escribe el número de la licencia: 16 caracteres en Gran Bretaña u 8 números en Irlanda del Norte, sin espacios.',
    },
  },
};

/** Países admitidos, con su nombre en español. Primero los mercados principales; el resto en orden alfabético. */
export const PAISES: readonly { codigo: string; nombre: string }[] = [
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'US', nombre: 'Estados Unidos' },
  { codigo: 'GB', nombre: 'Reino Unido' },
  ...[
    { codigo: 'DE', nombre: 'Alemania' },
    { codigo: 'BO', nombre: 'Bolivia' },
    { codigo: 'BR', nombre: 'Brasil' },
    { codigo: 'CA', nombre: 'Canadá' },
    { codigo: 'CL', nombre: 'Chile' },
    { codigo: 'CR', nombre: 'Costa Rica' },
    { codigo: 'CU', nombre: 'Cuba' },
    { codigo: 'EC', nombre: 'Ecuador' },
    { codigo: 'SV', nombre: 'El Salvador' },
    { codigo: 'ES', nombre: 'España' },
    { codigo: 'FR', nombre: 'Francia' },
    { codigo: 'GT', nombre: 'Guatemala' },
    { codigo: 'HN', nombre: 'Honduras' },
    { codigo: 'IT', nombre: 'Italia' },
    { codigo: 'NI', nombre: 'Nicaragua' },
    { codigo: 'PA', nombre: 'Panamá' },
    { codigo: 'PY', nombre: 'Paraguay' },
    { codigo: 'PE', nombre: 'Perú' },
    { codigo: 'PT', nombre: 'Portugal' },
    { codigo: 'DO', nombre: 'República Dominicana' },
    { codigo: 'UY', nombre: 'Uruguay' },
    { codigo: 'VE', nombre: 'Venezuela' },
  ],
];

const NOMBRE_PAIS = new Map(PAISES.map((p) => [p.codigo, p.nombre]));

function reglasDe(pais: string): Partial<Record<TipoDocumento, Regla>> | null {
  if (!NOMBRE_PAIS.has(pais)) return null;
  return REGLAS_POR_PAIS[pais] ?? { PA: PASAPORTE, DNI: NACIONAL };
}

/** Los tipos que se pueden elegir para un país, en el orden en que se muestran. */
export function tiposDocumento(
  pais: string,
): { codigo: TipoDocumento; nombre: string; numerico: boolean }[] {
  const reglas = reglasDe(pais);
  if (!reglas) return [];
  return (Object.entries(reglas) as [TipoDocumento, Regla][]).map(([codigo, r]) => ({
    codigo,
    nombre: r.nombre,
    numerico: r.numerico === true,
  }));
}

export function nombrePais(pais: string): string {
  return NOMBRE_PAIS.get(pais) ?? pais;
}

/** "Cédula de ciudadanía", "Pasaporte"… El código si no se conoce (datos viejos o un tipo retirado). */
export function nombreDocumento(pais: string, tipo: string): string {
  return reglasDe(pais)?.[tipo as TipoDocumento]?.nombre ?? tipo;
}

export type ResultadoDocumento =
  | { ok: true; numero: string }
  | { ok: false; campo: 'documentoPais' | 'documentoTipo' | 'documento'; mensaje: string };

/**
 * Valida un documento. Las letras se pasan a mayúsculas; cualquier otro carácter que no sea letra o número (puntos,
 * comas, espacios, guiones) se rechaza con un mensaje que dice cómo escribirlo.
 */
export function validarDocumento(pais: string, tipo: string, numero: string): ResultadoDocumento {
  const reglas = reglasDe(pais);
  if (!reglas)
    return {
      ok: false,
      campo: 'documentoPais',
      mensaje: 'Elige el país que expidió tu documento.',
    };
  const regla = reglas[tipo as TipoDocumento];
  if (!regla) return { ok: false, campo: 'documentoTipo', mensaje: 'Elige el tipo de documento.' };
  const valor = numero.trim().toUpperCase();
  if (!valor)
    return { ok: false, campo: 'documento', mensaje: 'Escribe el número de tu documento.' };
  if (regla.numerico && /[^0-9]/.test(valor)) {
    return {
      ok: false,
      campo: 'documento',
      mensaje: 'Escribe solo números, sin puntos, comas, espacios ni letras.',
    };
  }
  if (/[^A-Z0-9]/.test(valor)) {
    return {
      ok: false,
      campo: 'documento',
      mensaje: 'Usa solo letras y números, sin espacios, puntos, comas ni guiones.',
    };
  }
  if (!regla.patron.test(valor)) return { ok: false, campo: 'documento', mensaje: regla.ayuda };
  return { ok: true, numero: valor };
}

/**
 * Lo que identifica al documento para no repetir cuentas. La cédula colombiana conserva su forma de antes (solo el
 * número) para que los clientes registrados antes de los tipos de documento sigan siendo únicos con la misma huella.
 */
export function claveDocumento(pais: string, tipo: string, numero: string): string {
  return pais === 'CO' && tipo === 'CC' ? numero : `${pais}:${tipo}:${numero}`;
}
