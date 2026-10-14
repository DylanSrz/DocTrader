import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { COLA_MANTENIMIENTO, TRABAJO_LATIDO } from './latido.js';

/** Registra los trabajos periódicos. `upsertJobScheduler` no duplica nada si el worker se reinicia. */
@Injectable()
export class ProgramarTrabajos implements OnApplicationBootstrap {
  constructor(@InjectQueue(COLA_MANTENIMIENTO) private readonly mantenimiento: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_LATIDO,
      { every: 60_000 },
      { name: TRABAJO_LATIDO, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }
}
