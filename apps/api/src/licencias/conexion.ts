import { ESTADO_CONEXION, type EstadoConexion } from '@doctrader/shared';

/**
 * Lo que pasa con la conexión de la cuenta cuando su licencia vuelve a estar vigente: al aprobar un pago, al
 * extender días a una vencida o al reactivar una suspendida (`docs/MODELO-DATOS.md` §4.4).
 */
export function conexionAlActivar(actual: EstadoConexion): EstadoConexion {
  switch (actual) {
    case ESTADO_CONEXION.SIN_LICENCIA:
    case ESTADO_CONEXION.DESCONECTADA:
      return ESTADO_CONEXION.POR_CONECTAR;
    // Volvió antes de que la desconectaran: sigue conectada.
    case ESTADO_CONEXION.POR_DESCONECTAR:
      return ESTADO_CONEXION.CONECTADA;
    default:
      return actual;
  }
}

/** Lo que pasa con la conexión cuando la licencia deja de estar vigente (vence o se suspende). */
export function conexionAlDesactivar(actual: EstadoConexion): EstadoConexion {
  switch (actual) {
    case ESTADO_CONEXION.CONECTADA:
      return ESTADO_CONEXION.POR_DESCONECTAR;
    // Nunca se conectó: deja de estar en la lista.
    case ESTADO_CONEXION.POR_CONECTAR:
      return ESTADO_CONEXION.SIN_LICENCIA;
    default:
      return actual;
  }
}
