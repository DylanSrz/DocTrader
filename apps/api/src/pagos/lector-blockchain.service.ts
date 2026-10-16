import { createHmac } from 'node:crypto';
import {
  esTransferenciaBinance,
  type Moneda,
  PREFIJO_BINANCE,
  RED,
  type Red,
} from '@doctrader/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';
import { type DepositoBinance, leerDepositoBinance } from './binance.js';
import { leerEsplora } from './bitcoin.js';
import { ErrorProveedor, type Lectura } from './lectura.js';
import { leerTronGrid, leerTronscan } from './tron.js';

const ESPERA = 8_000;

export interface LecturaConProveedor {
  lectura: Lectura;
  proveedor: string;
}

/** Lo que hace falta saber de la orden para buscar una transferencia interna de Binance. */
export interface ContextoLectura {
  moneda: Moneda;
  creadaEn: Date;
}

/** Hay una transferencia interna de Binance por verificar y no hay llave de API: la revisa un admin a mano. */
export class SinLlaveBinance extends ErrorProveedor {
  constructor() {
    super(
      'Es un pago entre cuentas de Binance y no hay llave de API para verificarlo: búscalo en Binance (Billetera → Historial de depósitos) y, si llegó el monto exacto, apruébalo de todos modos.',
    );
  }
}

const BINANCE_API = 'https://api.binance.com';
/** Ventana que se pide al historial de Binance: desde un poco antes de crear la orden (relojes) hasta ahora. */
const MARGEN_BINANCE_MS = 10 * 60_000;

/**
 * Lee una transacción en la blockchain con un proveedor principal y uno de respaldo por red
 * (`docs/DECISIONES-TECNICAS.md` §2). Si los dos fallan, lanza `ErrorProveedor`: el pago queda "por verificar" y se
 * reintenta. Se puede reemplazar en las pruebas.
 */
@Injectable()
export class LectorBlockchain {
  private readonly logger = new Logger(LectorBlockchain.name);
  private readonly llaveTronGrid: string | undefined;
  private readonly llaveTronscan: string | undefined;
  private readonly binance: { llave: string; secreto: string } | null;

  constructor(config: ConfigService<Entorno, true>) {
    this.llaveTronGrid = config.get('TRONGRID_API_KEY', { infer: true });
    this.llaveTronscan = config.get('TRONSCAN_API_KEY', { infer: true });
    const llave = config.get('BINANCE_API_KEY', { infer: true });
    const secreto = config.get('BINANCE_API_SECRET', { infer: true });
    this.binance = llave && secreto ? { llave, secreto } : null;
  }

  async leer(red: Red, hash: string, contexto?: ContextoLectura): Promise<LecturaConProveedor> {
    if (esTransferenciaBinance(hash)) {
      if (!contexto) throw new ErrorProveedor('Falta la orden para buscar el pago en Binance');
      return {
        lectura: await this.depositoBinance(hash.slice(PREFIJO_BINANCE.length), contexto),
        proveedor: 'Binance',
      };
    }
    const proveedores =
      red === RED.TRON
        ? [
            { nombre: 'TronGrid', leer: () => this.tronGrid(hash) },
            { nombre: 'Tronscan', leer: () => this.tronscan(hash) },
          ]
        : [
            {
              nombre: 'mempool.space',
              leer: () => this.esplora('https://mempool.space/api', hash),
            },
            {
              nombre: 'Blockstream',
              leer: () => this.esplora('https://blockstream.info/api', hash),
            },
          ];
    const errores: string[] = [];
    for (const proveedor of proveedores) {
      try {
        return { lectura: await proveedor.leer(), proveedor: proveedor.nombre };
      } catch (error) {
        errores.push(`${proveedor.nombre}: ${(error as Error).message}`);
        this.logger.warn(
          `${proveedor.nombre} no respondió para ${hash}: ${(error as Error).message}`,
        );
      }
    }
    throw new ErrorProveedor(errores.join(' · '));
  }

  /**
   * Historial de depósitos de la cuenta de cobro (`docs/DECISIONES-TECNICAS.md` §2). La llave es de solo lectura.
   * Binance no responde a servidores en Estados Unidos (451): el worker debe correr en otra región.
   */
  private async depositoBinance(numero: string, contexto: ContextoLectura): Promise<Lectura> {
    if (!this.binance) throw new SinLlaveBinance();
    const parametros = new URLSearchParams({
      startTime: String(contexto.creadaEn.getTime() - MARGEN_BINANCE_MS),
      endTime: String(Date.now()),
      limit: '1000',
      recvWindow: '10000',
      timestamp: String(Date.now()),
    });
    const firma = createHmac('sha256', this.binance.secreto)
      .update(parametros.toString())
      .digest('hex');
    parametros.set('signature', firma);
    const respuesta = await fetch(
      `${BINANCE_API}/sapi/v1/capital/deposit/hisrec?${parametros.toString()}`,
      { headers: { 'X-MBX-APIKEY': this.binance.llave }, signal: AbortSignal.timeout(ESPERA) },
    );
    if (respuesta.status === 451) {
      throw new ErrorProveedor('Binance no responde desde la región del servidor (451)');
    }
    if (!respuesta.ok) throw new ErrorProveedor(`Binance respondió ${respuesta.status}`);
    const depositos = (await respuesta.json()) as unknown;
    if (!Array.isArray(depositos)) throw new ErrorProveedor('Binance respondió algo inesperado');
    return leerDepositoBinance(depositos as DepositoBinance[], numero, contexto.moneda);
  }

  private async tronGrid(hash: string): Promise<Lectura> {
    const encabezados: Record<string, string> = this.llaveTronGrid
      ? { 'TRON-PRO-API-KEY': this.llaveTronGrid }
      : {};
    const [info, ahora] = await Promise.all([
      this.json('https://api.trongrid.io/wallet/gettransactioninfobyid', {
        method: 'POST',
        body: JSON.stringify({ value: hash }),
        headers: { 'content-type': 'application/json', ...encabezados },
      }),
      this.json('https://api.trongrid.io/wallet/getnowblock', {
        method: 'POST',
        headers: encabezados,
      }),
    ]);
    const altura = (ahora as { block_header?: { raw_data?: { number?: number } } })?.block_header
      ?.raw_data?.number;
    if (typeof altura !== 'number') throw new ErrorProveedor('Sin la altura actual de Tron');
    return leerTronGrid(info as Parameters<typeof leerTronGrid>[0], altura);
  }

  private async tronscan(hash: string): Promise<Lectura> {
    const info = await this.json(
      `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(hash)}`,
      { headers: this.llaveTronscan ? { 'TRON-PRO-API-KEY': this.llaveTronscan } : {} },
    );
    return leerTronscan(info as Parameters<typeof leerTronscan>[0]);
  }

  private async esplora(base: string, hash: string): Promise<Lectura> {
    const [respuesta, altura] = await Promise.all([
      fetch(`${base}/tx/${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(ESPERA) }),
      this.texto(`${base}/blocks/tip/height`),
    ]);
    const tip = Number(altura);
    if (!Number.isSafeInteger(tip)) throw new ErrorProveedor('Sin la altura actual de Bitcoin');
    // 404 con "Transaction not found": la transacción no existe (todavía).
    if (respuesta.status === 404) return leerEsplora(null, tip);
    if (!respuesta.ok) throw new ErrorProveedor(`Respondió ${respuesta.status}`);
    return leerEsplora((await respuesta.json()) as Parameters<typeof leerEsplora>[0], tip);
  }

  private async json(url: string, init: RequestInit = {}): Promise<unknown> {
    const respuesta = await fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA) });
    if (!respuesta.ok) throw new ErrorProveedor(`Respondió ${respuesta.status}`);
    return respuesta.json();
  }

  private async texto(url: string): Promise<string> {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA) });
    if (!respuesta.ok) throw new ErrorProveedor(`Respondió ${respuesta.status}`);
    return respuesta.text();
  }
}
