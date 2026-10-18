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
export type ClaveChequeo = 'HASH' | 'DESTINO' | 'MONTO' | 'FECHA' | 'CONFIRMACIONES' | 'UNICO';
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
  /** Se reportó el número de una transferencia interna de Binance, no un hash. */
  interna?: boolean;
  /**
   * Órdenes de otros clientes por el mismo monto y la misma red que estaban abiertas cuando se envió el pago (las
   * cuenta el servicio con la hora de la transacción). Si hay alguna, el pago pudo ser de cualquiera.
   */
  otrasConMismoMonto?: number;
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
      nota: orden.interna
        ? vencida
          ? 'No encontramos esa transferencia en el historial de depósitos de Binance. El número puede estar mal.'
          : 'La transferencia todavía no aparece en el historial de Binance. Volvemos a mirar en un momento.'
        : vencida
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
  const interna = lectura.interna === true;
  const chequeos: Chequeo[] = [
    {
      clave: 'HASH',
      estado: 'OK',
      texto: interna
        ? 'El número de la transferencia de Binance no se había usado'
        : 'El hash no se había usado',
    },
  ];

  let destino: Chequeo;
  if (!lectura.exitosa) {
    destino = { clave: 'DESTINO', estado: 'FALLA', texto: 'La transacción falló en la blockchain' };
  } else if (recibido > 0n) {
    destino = {
      clave: 'DESTINO',
      estado: 'OK',
      texto: interna
        ? `Llegó a la dirección de la orden, en ${orden.moneda}, por transferencia interna de Binance`
        : `Llegó a la dirección de la orden, en ${orden.moneda} por ${red}`,
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

  // Exacto: es lo que se le pidió al cliente. Uno mayor puede ser el pago de otra persona; lo revisa un admin (ve los
  // remitentes) y lo aprueba a mano si corresponde.
  const montoOk = recibido === orden.unidades;
  const montoMayor = recibido > orden.unidades;
  chequeos.push({
    clave: 'MONTO',
    estado: montoOk ? 'OK' : 'FALLA',
    texto: montoOk
      ? 'El monto es igual al de la orden'
      : montoMayor
        ? `Llegó más que el monto de la orden (${monto(recibido)} de ${monto(orden.unidades)}): revisa que sea de este cliente`
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
    texto: interna
      ? confirmaciones >= minimoConfirmaciones
        ? 'Binance ya la acreditó (no necesita confirmaciones)'
        : 'Binance todavía la está procesando'
      : `${Math.min(confirmaciones, minimoConfirmaciones)} de ${minimoConfirmaciones} confirmaciones`,
  });

  // En USDT se cobra el precio exacto, así que dos clientes pueden pagar lo mismo a la misma hora: nadie debe poder
  // reportar como suyo el pago de otro. Si había otra orden igual abierta, un admin confirma quién lo envió.
  const compartido = montoOk && (orden.otrasConMismoMonto ?? 0) > 0;
  if (compartido) {
    chequeos.push({
      clave: 'UNICO',
      estado: 'FALLA',
      texto:
        orden.otrasConMismoMonto === 1
          ? 'Otro cliente tenía una orden abierta por el mismo monto a esa hora: confirma con el cliente (captura del envío) antes de aprobar'
          : `Otros ${orden.otrasConMismoMonto} clientes tenían órdenes abiertas por el mismo monto a esa hora: confirma con el cliente (captura del envío) antes de aprobar`,
    });
  }

  let estado: EstadoVerificacion;
  if (destino.estado === 'FALLA' || fecha.estado === 'FALLA' || montoMayor) {
    estado = ESTADO_VERIFICACION.NO_COINCIDE;
  } else if (!montoOk) {
    estado = ESTADO_VERIFICACION.MONTO_INCOMPLETO;
  } else if (chequeos.some((c) => c.estado === 'ESPERA')) {
    estado = ESTADO_VERIFICACION.ESPERANDO_CONFIRMACIONES;
  } else if (compartido) {
    estado = ESTADO_VERIFICACION.POR_CONFIRMAR;
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
