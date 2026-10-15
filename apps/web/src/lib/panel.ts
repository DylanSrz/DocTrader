import 'server-only';
import type {
  CodigoPlan,
  EstadoConexion,
  EstadoLicencia,
  EstadoOrden,
  EstadoVerificacion,
  Moneda,
  NivelRiesgo,
  Red,
  TipoOrden,
  TipoPeriodo,
} from '@doctrader/shared';
import { redirect } from 'next/navigation';
import { llamarApi } from './api';
import { tokenDeSesion } from './sesion';

/** Lo que devuelve la API del panel del cliente (ver `apps/api/src/licencias/vista.ts`). Las fechas llegan como texto. */

export interface PlanVista {
  codigo: CodigoPlan;
  nombre: string;
  meses: number | null;
  mesesObsequio: number;
  dias: number | null;
  precioUsdCentavos: number;
  rango: number;
}

export interface CuentaVista {
  id: string;
  titular: string;
  broker: string;
  servidor: string;
  numero: string;
  conexion: EstadoConexion;
  capitalRecomendadoUsdCentavos: number | null;
  riesgo: NivelRiesgo | null;
  bloqueadaHasta: string | null;
  creadaEn: string;
  licencia: {
    id: string;
    estado: EstadoLicencia;
    esPrueba: boolean;
    plan: PlanVista | null;
    inicio: string | null;
    fin: string | null;
    finGracia: string | null;
    periodos: {
      tipo: TipoPeriodo;
      plan: CodigoPlan | null;
      inicio: string;
      fin: string;
      mesesObsequio: number;
    }[];
  };
  ordenAbierta: { numero: string; estado: EstadoOrden; expiraEn: string } | null;
}

export interface MisCuentas {
  cuentas: CuentaVista[];
  planes: PlanVista[];
  diasGracia: number;
}

export interface OrdenVista {
  id: string;
  numero: string;
  tipo: TipoOrden;
  estado: EstadoOrden;
  plan: PlanVista;
  cuenta: { id: string; numero: string; broker: string };
  precioUsdCentavos: number;
  creditoUsdCentavos: number;
  montoUsdCentavos: number;
  moneda: Moneda;
  red: Red;
  direccion: string;
  monto: string;
  precioBtcUsd: string | null;
  creadaEn: string;
  expiraEn: string;
  hash: string | null;
  enlaceExplorador: string | null;
  reportadaEn: string | null;
  verificacion: EstadoVerificacion | null;
  confirmaciones: number | null;
  confirmacionesNecesarias: number;
  vencimientoSiSeAprueba: string | null;
  motivoRechazo: string | null;
}

export interface Perfil {
  nombre: string;
  correo: string;
  telefono: string | null;
  cedulaUltimos4: string | null;
  clienteDesde: string;
  segundoFactor: boolean;
}

/** Lee del panel con la sesión del cliente. Si la sesión ya no sirve, vuelve a ingresar. */
export async function leerPanel<T>(ruta: string): Promise<T> {
  const token = await tokenDeSesion();
  if (!token) redirect('/ingresar');
  const respuesta = await llamarApi<T>(ruta, { token });
  if (respuesta.ok) return respuesta.datos;
  if (respuesta.estado === 401) redirect('/ingresar');
  throw new Error(respuesta.error.mensaje);
}
