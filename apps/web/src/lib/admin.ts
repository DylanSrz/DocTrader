import type {
  CodigoPlan,
  EstadoConexion,
  EstadoDireccion,
  EstadoLicencia,
  EstadoOrden,
  EstadoUsuario,
  EstadoVerificacion,
  FiltroLicencias,
  Moneda,
  NivelRiesgo,
  Red,
  TipoOrden,
  TipoPeriodo,
} from '@doctrader/shared';

/** Respuestas de la API del panel de administración (`apps/api/src/admin`). Las fechas llegan como texto ISO. */

export interface Resumen {
  pendientes: {
    pagos: number;
    pruebas: number;
    tickets: number;
    porConectar: number;
    porDesconectar: number;
    vencenEn7Dias: number;
  };
  ventas: {
    mes: { usdCentavos: number; licencias: number };
    hoyUsdCentavos: number;
    mesAnteriorUsdCentavos: number;
    anioUsdCentavos: number;
    porMoneda: { moneda: Moneda; usdCentavos: number }[];
    porDia: { dia: number; plan: CodigoPlan; n: number; usdCentavos: number }[];
    calendario: { hoy: number; dias: number; mes: number; anio: number };
  };
  cuentas: {
    conectadas: number;
    nuevasMes: number;
    renovacionesMes: number;
    clientes: number;
    clientesVerificados: number;
  };
  actividad: { fecha: string; texto: string; sistema: boolean }[];
}

export interface CuentaDeTrabajo {
  id: string;
  desde: string;
  yaEstuvoConectada: boolean;
  cliente: { id: string; nombre: string; correo: string; telefono: string | null };
  titular: string;
  broker: string;
  servidor: string;
  numero: string;
  capitalUsdCentavos: number | null;
  riesgo: NivelRiesgo | null;
  contrasenasBorradas: boolean;
  licencia: {
    id: string;
    estado: EstadoLicencia;
    plan: string | null;
    vence: string | null;
    finGracia: string | null;
    motivoSuspension: string | null;
  };
  pago: { fecha: string; moneda: Moneda } | null;
}

export interface ListasCuentas {
  porConectar: CuentaDeTrabajo[];
  porDesconectar: CuentaDeTrabajo[];
  esperandoPago: {
    id: string;
    numero: string;
    broker: string;
    cliente: string;
    plan: string;
    orden: string;
    verificacion: EstadoVerificacion | null;
    moneda: Moneda;
    reportadaEn: string;
  }[];
  conectadas: number;
}

export interface ListaLicencias {
  filtro: FiltroLicencias;
  busqueda: string;
  conteos: Record<FiltroLicencias, number>;
  recortada: boolean;
  licencias: {
    id: string;
    estado: EstadoLicencia;
    plan: string | null;
    inicio: string | null;
    vence: string | null;
    finGracia: string | null;
    dias: number | null;
    cuenta: { id: string; numero: string; broker: string; conexion: EstadoConexion };
    cliente: { id: string; nombre: string };
  }[];
}

export interface Ficha {
  id: string;
  estado: EstadoLicencia;
  plan: string | null;
  inicio: string | null;
  vence: string | null;
  finGracia: string | null;
  suspension: { fecha: string; motivo: string | null } | null;
  cuenta: {
    id: string;
    titular: string;
    broker: string;
    servidor: string;
    numero: string;
    conexion: EstadoConexion;
    conectadaEn: string | null;
    capitalUsdCentavos: number | null;
    riesgo: NivelRiesgo | null;
    notas: string | null;
  };
  cliente: {
    id: string;
    nombre: string;
    correo: string;
    correoVerificado: boolean;
    telefono: string | null;
    cedulaFinal: string | null;
    desde: string;
    estado: EstadoUsuario;
  };
  otrasCuentas: { licenciaId: string; estado: EstadoLicencia; numero: string; broker: string }[];
  periodos: {
    tipo: TipoPeriodo;
    inicio: string;
    fin: string;
    plan: string;
    orden: string | null;
    nota: string | null;
    creadoPor: string | null;
  }[];
  pagos: {
    numero: string;
    tipo: TipoOrden;
    estado: EstadoOrden;
    moneda: Moneda;
    montoUsdCentavos: number;
    plan: string;
    creadaEn: string;
    decididaEn: string | null;
  }[];
}

export interface Ajustes {
  planes: {
    codigo: CodigoPlan;
    nombre: string;
    meses: number | null;
    dias: number | null;
    precioUsdCentavos: number;
  }[];
  diasPrueba: number;
  diasGracia: number;
  minutosOrden: number;
  confirmaciones: Record<Red, number>;
  aprobacionAutomatica: boolean;
  enlaces: { telegram: string; instagram: string; broker: { name: string; url: string } } | null;
  myfxbook: {
    url: string;
    figures: {
      gainPercent: string | null;
      maxDrawdownPercent: string | null;
      auditedSince: string | null;
      asOf: string | null;
    };
  } | null;
  correoSoporte: string | null;
  preguntas: number;
  diasCierreTickets: number;
  respuestasGuardadas: number;
  direcciones: {
    id: string;
    moneda: Moneda;
    red: Red;
    direccion: string;
    estado: EstadoDireccion;
    activaDesde: string;
    creadaEn: string;
    creadaPor: string | null;
    enUso: boolean;
  }[];
}

/** Cómo se ve cada estado de licencia en el panel del admin. */
export const ESTADO_LICENCIA_ADMIN: Record<
  EstadoLicencia,
  { texto: string; tono: 'senal' | 'llama' | 'neutro' | 'apagado' | 'error' }
> = {
  PENDIENTE_PAGO: { texto: 'Pendiente de pago', tono: 'apagado' },
  PRUEBA: { texto: 'En prueba', tono: 'senal' },
  ACTIVA: { texto: 'Activa', tono: 'senal' },
  EN_GRACIA: { texto: 'En gracia', tono: 'llama' },
  VENCIDA: { texto: 'Vencida', tono: 'error' },
  SUSPENDIDA: { texto: 'Suspendida', tono: 'error' },
};

export const NOMBRE_CONEXION: Record<EstadoConexion, string> = {
  SIN_LICENCIA: 'Sin conectar',
  POR_CONECTAR: 'Por conectar',
  CONECTADA: 'Conectada',
  POR_DESCONECTAR: 'Por desconectar',
  DESCONECTADA: 'Desconectada',
};
