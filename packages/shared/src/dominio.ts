/**
 * Valores fijos del dominio. Son los mismos de `docs/MODELO-DATOS.md`; si cambian allá, cambian aquí.
 * Se usan objetos `as const` en lugar de `enum` para que funcionen igual en la API y en la web.
 */

type ValorDe<T> = T[keyof T];

export const ROL = { ADMIN: 'ADMIN', CLIENTE: 'CLIENT' } as const;
export type Rol = ValorDe<typeof ROL>;

export const ESTADO_USUARIO = {
  ACTIVO: 'ACTIVE',
  SUSPENDIDO: 'SUSPENDED',
  BORRADO: 'DELETED',
} as const;
export type EstadoUsuario = ValorDe<typeof ESTADO_USUARIO>;

export const CODIGO_PLAN = {
  MENSUAL: 'MENSUAL',
  TRIMESTRAL: 'TRIMESTRAL',
  SEMESTRAL: 'SEMESTRAL',
  PRUEBA: 'PRUEBA',
} as const;
export type CodigoPlan = ValorDe<typeof CODIGO_PLAN>;

export const ESTADO_LICENCIA = {
  PENDIENTE_PAGO: 'PENDIENTE_PAGO',
  PRUEBA: 'PRUEBA',
  ACTIVA: 'ACTIVA',
  EN_GRACIA: 'EN_GRACIA',
  VENCIDA: 'VENCIDA',
  SUSPENDIDA: 'SUSPENDIDA',
} as const;
export type EstadoLicencia = ValorDe<typeof ESTADO_LICENCIA>;

export const TIPO_ORDEN = {
  NUEVA: 'NUEVA',
  RENOVACION: 'RENOVACION',
  CAMBIO_DE_PLAN: 'CAMBIO_DE_PLAN',
  PRUEBA: 'PRUEBA',
  COMPLETAR_PRUEBA: 'COMPLETAR_PRUEBA',
} as const;
export type TipoOrden = ValorDe<typeof TIPO_ORDEN>;

export const ESTADO_ORDEN = {
  PENDIENTE: 'PENDIENTE',
  REPORTADA: 'REPORTADA',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
  EXPIRADA: 'EXPIRADA',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoOrden = ValorDe<typeof ESTADO_ORDEN>;

export const ESTADO_VERIFICACION = {
  SIN_VERIFICAR: 'SIN_VERIFICAR',
  ESPERANDO_CONFIRMACIONES: 'ESPERANDO_CONFIRMACIONES',
  VERIFICADA: 'VERIFICADA',
  MONTO_INCOMPLETO: 'MONTO_INCOMPLETO',
  NO_COINCIDE: 'NO_COINCIDE',
  ERROR_PROVEEDOR: 'ERROR_PROVEEDOR',
} as const;
export type EstadoVerificacion = ValorDe<typeof ESTADO_VERIFICACION>;

export const MONEDA = { USDT: 'USDT', BTC: 'BTC' } as const;
export type Moneda = ValorDe<typeof MONEDA>;

export const RED = { TRON: 'TRON', BITCOIN: 'BITCOIN' } as const;
export type Red = ValorDe<typeof RED>;

/** Decimales de cada moneda: los montos se guardan en unidades base enteras. */
export const DECIMALES: Record<Moneda, number> = { USDT: 6, BTC: 8 };

export const ESTADO_DIRECCION = {
  EN_ESPERA: 'EN_ESPERA',
  ACTIVA: 'ACTIVA',
  INACTIVA: 'INACTIVA',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoDireccion = ValorDe<typeof ESTADO_DIRECCION>;

export const ESTADO_CONEXION = {
  SIN_LICENCIA: 'SIN_LICENCIA',
  POR_CONECTAR: 'POR_CONECTAR',
  CONECTADA: 'CONECTADA',
  POR_DESCONECTAR: 'POR_DESCONECTAR',
  DESCONECTADA: 'DESCONECTADA',
} as const;
export type EstadoConexion = ValorDe<typeof ESTADO_CONEXION>;

export const ESTADO_SOLICITUD_PRUEBA = {
  BLOQUEADA: 'BLOQUEADA',
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
} as const;
export type EstadoSolicitudPrueba = ValorDe<typeof ESTADO_SOLICITUD_PRUEBA>;

export const ESTADO_TICKET = {
  ABIERTO: 'ABIERTO',
  RESPONDIDO: 'RESPONDIDO',
  RESUELTO: 'RESUELTO',
  CERRADO: 'CERRADO',
} as const;
export type EstadoTicket = ValorDe<typeof ESTADO_TICKET>;

/** Autorizaciones que se guardan en `consents` (Ley 1581). */
export const TIPO_CONSENTIMIENTO = {
  TERMINOS: 'TERMS',
  DATOS: 'PRIVACY',
  RIESGO: 'RISK',
  MERCADEO: 'MARKETING',
} as const;
export type TipoConsentimiento = ValorDe<typeof TIPO_CONSENTIMIENTO>;

/** Textos legales que se publican desde el panel (`legal_documents`). */
export const TIPO_DOCUMENTO_LEGAL = {
  TERMINOS: 'TERMS',
  DATOS: 'PRIVACY',
  RIESGO: 'RISK',
} as const;
export type TipoDocumentoLegal = ValorDe<typeof TIPO_DOCUMENTO_LEGAL>;

/** Ruta pública de cada texto legal (`/legal/terminos`, …) y su título. */
export const DOCUMENTOS_LEGALES: Record<TipoDocumentoLegal, { ruta: string; titulo: string }> = {
  TERMS: { ruta: 'terminos', titulo: 'Términos de la licencia' },
  PRIVACY: { ruta: 'datos', titulo: 'Tratamiento de datos personales' },
  RISK: { ruta: 'riesgo', titulo: 'Aviso de riesgo' },
};

/**
 * En qué punto está una sesión: completa, esperando el código del segundo factor, o (solo admins) obligada a
 * configurar el segundo factor antes de poder hacer cualquier otra cosa.
 */
export const ESTADO_SESION = {
  COMPLETA: 'COMPLETA',
  SEGUNDO_FACTOR_PENDIENTE: 'SEGUNDO_FACTOR_PENDIENTE',
  SEGUNDO_FACTOR_POR_CONFIGURAR: 'SEGUNDO_FACTOR_POR_CONFIGURAR',
} as const;
export type EstadoSesion = ValorDe<typeof ESTADO_SESION>;
