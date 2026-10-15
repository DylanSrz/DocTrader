import {
  deUnidadesBase,
  ESTADO_VERIFICACION,
  type EstadoVerificacion,
  type Moneda,
  NOMBRE_RED,
  type Red,
} from '@doctrader/shared';
import type { Lectura } from './lectura.js';

/** Los cinco chequeos de cada pago (`docs/CONTEXTO.md`, "Pagos"). */
export type ClaveChequeo = 'HASH' | 'DESTINO' | 'MONTO' | 'FECHA' | 'CONFIRMACIONES';
export type EstadoChequeo = 'OK' | 'FALLA' | 'ESPERA';

export interface Chequeo {
  clave: ClaveChequeo;
  estado: EstadoChequeo;
  texto: string;
}

export interface ResultadoVerificacion {
  estado: EstadoVerificacion;
  chequeos: Chequeo[];
  /** Una frase para el admin cuando no hay transacción que mirar ("todavía no aparece"). */
  nota: string | null;
  recibido: bigint | null;
  confirmaciones: number | null;
  hora: Date | null;
  bloque: number | null;
  remitentes: string[];
}

export interface OrdenAVerificar {
  direccion: string;
  moneda: Moneda;
  red: Red;
  unidades: bigint;
  creadaEn: Date;
  reportadaEn: Date;
}

/** Diferencia de relojes aceptada entre el servidor y la blockchain para el chequeo de la fecha. */
const TOLERANCIA_RELOJ_MS = 2 * 60_000;
/** Si en este tiempo la transacción no aparece, se deja de esperar: no existe o es de otra red. */
export const ESPERA_MAXIMA_MS = 6 * 60 * 60_000;

/**
 * Compara lo que se leyó en la blockchain con la orden. Es una función pura: no consulta nada, así se prueba con
 * respuestas reales grabadas.
 */
export function evaluar(
  orden: OrdenAVerificar,
  lectura: Lectura,
  minimoConfirmaciones: number,
  ahora: Date = new Date(),
): ResultadoVerificacion {
  const monto = (unidades: bigint) => `${deUnidadesBase(unidades, orden.moneda)} ${orden.moneda}`;
  const red = NOMBRE_RED[orden.red];

  if (!lectura.encontrada) {
    const vencida = ahora.getTime() - orden.reportadaEn.getTime() > ESPERA_MAXIMA_MS;
    return {
      estado: vencida ? ESTADO_VERIFICACION.NO_COINCIDE : ESTADO_VERIFICACION.SIN_VERIFICAR,
      chequeos: [],
      nota: vencida
        ? `No encontramos la transacción en la red ${red}. Puede ser de otra red o el código está mal.`
        : `La transacción todavía no aparece en la red ${red}. Volvemos a mirar en un momento.`,
      recibido: null,
      confirmaciones: null,
      hora: null,
      bloque: null,
      remitentes: [],
    };
  }

  const recibido = lectura.pagos
    .filter((p) => p.direccion === orden.direccion)
    .reduce((suma, p) => suma + p.unidades, 0n);
  const chequeos: Chequeo[] = [{ clave: 'HASH', estado: 'OK', texto: 'El hash no se había usado' }];

  let destino: Chequeo;
  if (!lectura.exitosa) {
    destino = { clave: 'DESTINO', estado: 'FALLA', texto: 'La transacción falló en la blockchain' };
  } else if (recibido > 0n) {
    destino = {
      clave: 'DESTINO',
      estado: 'OK',
      texto: `Llegó a la dirección de la orden, en ${orden.moneda} por ${red}`,
    };
  } else if (lectura.otraMoneda) {
    destino = {
      clave: 'DESTINO',
      estado: 'FALLA',
      texto: `Llegó otra moneda: la orden es en ${orden.moneda}`,
    };
  } else {
    destino = {
      clave: 'DESTINO',
      estado: 'FALLA',
      texto: 'No llegó nada a la dirección de esta orden',
    };
  }
  chequeos.push(destino);

  const montoOk = recibido >= orden.unidades;
  chequeos.push({
    clave: 'MONTO',
    estado: montoOk ? 'OK' : 'FALLA',
    texto: montoOk
      ? recibido === orden.unidades
        ? 'El monto es igual al de la orden'
        : `El monto es mayor al de la orden (${monto(recibido)} de ${monto(orden.unidades)})`
      : `El monto es menor al de la orden (${monto(recibido)} de ${monto(orden.unidades)})`,
  });

  const fecha: Chequeo =
    lectura.hora === null
      ? { clave: 'FECHA', estado: 'ESPERA', texto: 'Falta que entre en un bloque' }
      : lectura.hora.getTime() >= orden.creadaEn.getTime() - TOLERANCIA_RELOJ_MS
        ? { clave: 'FECHA', estado: 'OK', texto: 'Se envió después de crear la orden' }
        : { clave: 'FECHA', estado: 'FALLA', texto: 'Se envió antes de crear la orden' };
  chequeos.push(fecha);

  const confirmaciones = Math.min(lectura.confirmaciones, 1_000_000);
  chequeos.push({
    clave: 'CONFIRMACIONES',
    estado: confirmaciones >= minimoConfirmaciones ? 'OK' : 'ESPERA',
    texto: `${Math.min(confirmaciones, minimoConfirmaciones)} de ${minimoConfirmaciones} confirmaciones`,
  });

  let estado: EstadoVerificacion;
  if (destino.estado === 'FALLA' || fecha.estado === 'FALLA') {
    estado = ESTADO_VERIFICACION.NO_COINCIDE;
  } else if (!montoOk) {
    estado = ESTADO_VERIFICACION.MONTO_INCOMPLETO;
  } else if (chequeos.some((c) => c.estado === 'ESPERA')) {
    estado = ESTADO_VERIFICACION.ESPERANDO_CONFIRMACIONES;
  } else {
    estado = ESTADO_VERIFICACION.VERIFICADA;
  }

  return {
    estado,
    chequeos,
    nota: null,
    recibido,
    confirmaciones,
    hora: lectura.hora,
    bloque: lectura.bloque,
    remitentes: lectura.remitentes,
  };
}
