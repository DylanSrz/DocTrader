import { RED, type Red } from '@doctrader/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';
import { leerEsplora } from './bitcoin.js';
import { ErrorProveedor, type Lectura } from './lectura.js';
import { leerTronGrid, leerTronscan } from './tron.js';

const ESPERA = 8_000;

export interface LecturaConProveedor {
  lectura: Lectura;
  proveedor: string;
}

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

  constructor(config: ConfigService<Entorno, true>) {
    this.llaveTronGrid = config.get('TRONGRID_API_KEY', { infer: true });
    this.llaveTronscan = config.get('TRONSCAN_API_KEY', { infer: true });
  }

  async leer(red: Red, hash: string): Promise<LecturaConProveedor> {
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
