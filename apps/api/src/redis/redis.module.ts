import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Entorno } from '../config/entorno.js';

export const REDIS = Symbol('REDIS');

@Injectable()
class CerrarRedis implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}

/** Cliente de Redis compartido (sesiones, límites de velocidad, latido del worker). */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          // La red privada de Railway usa IPv6: `family: 0` deja que ioredis resuelva IPv4 o IPv6.
          family: 0,
        }),
    },
    CerrarRedis,
  ],
  exports: [REDIS],
})
export class RedisModule {}
