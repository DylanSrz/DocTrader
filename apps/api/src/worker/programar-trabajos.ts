import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  COLA_MANTENIMIENTO,
  TRABAJO_ENVIAR_AVISOS,
  TRABAJO_EXPIRAR_ORDENES,
  TRABAJO_LATIDO,
} from './latido.js';

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
    // Los correos de verificación y de recuperar contraseña no deben tardar: se revisa la bandeja cada 5 segundos.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_ENVIAR_AVISOS,
      { every: 5_000 },
      { name: TRABAJO_ENVIAR_AVISOS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Una orden vale una hora: cada minuto se marcan las que vencieron.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_EXPIRAR_ORDENES,
      { every: 60_000 },
      { name: TRABAJO_EXPIRAR_ORDENES, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }
}
