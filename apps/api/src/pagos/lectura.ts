/**
 * Lo que la plataforma lee de una transacción en la blockchain, igual para todas las redes. Cada proveedor (TronGrid,
 * Tronscan, mempool.space, Blockstream) traduce su respuesta a esta forma; la verificación solo mira esto.
 */
export type Lectura =
  | { encontrada: false }
  | {
      encontrada: true;
      /** La transacción se ejecutó (en Tron un contrato puede fallar y quedar igual en un bloque). */
      exitosa: boolean;
      /** Hora del bloque; nula mientras no está en un bloque. */
      hora: Date | null;
      bloque: number | null;
      confirmaciones: number;
      /** Lo que llegó a cada dirección en la moneda verificada (USDT en Tron, BTC en Bitcoin), en unidades base. */
      pagos: { direccion: string; unidades: bigint }[];
      /** En Tron: llegaron transferencias de otro token (otra moneda). */
      otraMoneda: boolean;
      /** Billetera(s) de origen; quedan con el pago para consultarlas después. */
      remitentes: string[];
    };

/** El proveedor no respondió o respondió algo que no se entiende: se reintenta, nunca se aprueba así. */
export class ErrorProveedor extends Error {}
