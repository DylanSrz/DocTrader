import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { AvisosEnvio } from '../avisos/avisos-envio.js';
import { REDIS } from '../redis/redis.module.js';
import {
  CLAVE_LATIDO_WORKER,
  COLA_MANTENIMIENTO,
  TRABAJO_ENVIAR_AVISOS,
  TRABAJO_LATIDO,
} from './latido.js';

/** Trabajos de mantenimiento: el latido (prueba que el worker está vivo) y el envío de correos pendientes. */
@Processor(COLA_MANTENIMIENTO)
export class MantenimientoProcessor extends WorkerHost {
  private readonly logger = new Logger(MantenimientoProcessor.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly avisos: AvisosEnvio,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case TRABAJO_LATIDO:
        await this.redis.set(CLAVE_LATIDO_WORKER, new Date().toISOString(), 'EX', 600);
        return;
      case TRABAJO_ENVIAR_AVISOS:
        await this.avisos.enviarPendientes();
        return;
      default:
        this.logger.warn(`Trabajo desconocido en ${COLA_MANTENIMIENTO}: ${job.name}`);
    }
  }
}
