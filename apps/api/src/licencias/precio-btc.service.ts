import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { DataSource } from 'typeorm';
import { AvisosService } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import type { Entorno } from '../config/entorno.js';
import { REDIS } from '../redis/redis.module.js';
import { errorApi } from '../seguridad/errores.js';
import { aCentavos, centavosATexto, elegirPrecio } from './precio-btc.js';

const CLAVE_CACHE = 'precio-btc';
/** Un precio consultado sirve unos segundos para varias órdenes seguidas; la orden lo deja fijo una hora. */
const SEGUNDOS_CACHE = 30;
const ESPERA_PROVEEDOR = 5_000;

/** Consulta el precio de BTC en dólares (centavos). Se puede reemplazar en las pruebas. */
@Injectable()
export class PrecioBtcService {
  private readonly logger = new Logger(PrecioBtcService.name);
  private readonly llaveCoingecko: string | undefined;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
    config: ConfigService<Entorno, true>,
  ) {
    this.llaveCoingecko = config.get('COINGECKO_API_KEY', { infer: true });
  }

  async cotizar(): Promise<bigint> {
    const guardado = await this.redis.get(CLAVE_CACHE);
    if (guardado) return BigInt(guardado);

    const [binance, coingecko] = await Promise.all([this.binance(), this.coingecko()]);
    const cotizacion = elegirPrecio(binance, coingecko);
    if (!cotizacion.ok) {
      if (cotizacion.motivo === 'NO_COINCIDEN') {
        this.logger.warn(
          `Precios de BTC distintos: Binance ${cotizacion.binance}, CoinGecko ${cotizacion.coingecko}`,
        );
        await this.avisarAdmins(cotizacion.binance, cotizacion.coingecko);
      } else {
        this.logger.error('Ningún proveedor del precio de BTC respondió');
      }
      throw errorApi(
        HttpStatus.SERVICE_UNAVAILABLE,
        'PRECIO_BTC_NO_DISPONIBLE',
        'No pudimos fijar el precio de BTC en este momento. Intenta de nuevo en unos minutos o paga con USDT.',
      );
    }
    if (cotizacion.fuente !== 'BINANCE') this.logger.warn('Precio de BTC tomado de CoinGecko');
    await this.redis.set(CLAVE_CACHE, cotizacion.centavos.toString(), 'EX', SEGUNDOS_CACHE);
    return cotizacion.centavos;
  }

  private async binance(): Promise<bigint | null> {
    const datos = await this.consultar<{ price?: string }>(
      'https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT',
    );
    return datos?.price ? aCentavos(datos.price) : null;
  }

  private async coingecko(): Promise<bigint | null> {
    const datos = await this.consultar<{ bitcoin?: { usd?: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      this.llaveCoingecko ? { 'x-cg-demo-api-key': this.llaveCoingecko } : {},
    );
    return typeof datos?.bitcoin?.usd === 'number' ? aCentavos(datos.bitcoin.usd) : null;
  }

  private async consultar<T>(url: string, encabezados: Record<string, string> = {}) {
    try {
      const respuesta = await fetch(url, {
        headers: { accept: 'application/json', ...encabezados },
        signal: AbortSignal.timeout(ESPERA_PROVEEDOR),
      });
      if (!respuesta.ok) {
        this.logger.warn(`${new URL(url).host} respondió ${respuesta.status}`);
        return null;
      }
      return (await respuesta.json()) as T;
    } catch (error) {
      this.logger.warn(`${new URL(url).host} no respondió: ${(error as Error).message}`);
      return null;
    }
  }

  /** Un correo por hora a cada admin, aunque muchos clientes intenten pagar en BTC mientras tanto. */
  private async avisarAdmins(binance: bigint, coingecko: bigint): Promise<void> {
    const hora = new Date().toISOString().slice(0, 13);
    const admins = (await this.fuente.query(
      `SELECT id, email, full_name FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
    )) as { id: string; email: string; full_name: string }[];
    await this.fuente.transaction(async (m) => {
      for (const admin of admins) {
        await this.avisos.encolar(m, {
          usuarioId: admin.id,
          correo: admin.email,
          plantilla: PLANTILLA.PRECIO_BTC_DIFERENTE,
          datos: {
            nombre: admin.full_name.split(' ')[0] ?? admin.full_name,
            binance: centavosATexto(binance),
            coingecko: centavosATexto(coingecko),
          },
          clave: `precio-btc:${hora}:${admin.id}`,
        });
      }
    });
  }
}
