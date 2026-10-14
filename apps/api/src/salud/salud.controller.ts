import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import type { DataSource } from 'typeorm';
import { REDIS } from '../redis/redis.module.js';
import { Publica } from '../sesiones/decoradores.js';
import { CLAVE_LATIDO_WORKER } from '../worker/latido.js';

type Estado = 'ok' | 'falla';

/** Para el monitor de disponibilidad y el despliegue: responde 503 si la base de datos o Redis fallan. */
@Publica()
@Controller('salud')
export class SaludController {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async revisar(@Res({ passthrough: true }) res: Response) {
    const [baseDeDatos, redis] = await Promise.all([
      this.probar(() => this.fuente.query('SELECT 1')),
      this.probar(() => this.redis.ping()),
    ]);
    const latido = redis === 'ok' ? await this.redis.get(CLAVE_LATIDO_WORKER) : null;
    const estado: Estado = baseDeDatos === 'ok' && redis === 'ok' ? 'ok' : 'falla';
    if (estado === 'falla') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      estado,
      baseDeDatos,
      redis,
      // El worker es otro proceso: aquí solo se informa su último latido, no tumba la API.
      ultimoLatidoWorker: latido,
    };
  }

  private async probar(revision: () => Promise<unknown>): Promise<Estado> {
    try {
      await revision();
      return 'ok';
    } catch {
      return 'falla';
    }
  }
}
