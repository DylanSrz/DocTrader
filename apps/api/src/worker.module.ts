import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvisosEnvio } from './avisos/avisos-envio.js';
import { BaseModule } from './base.module.js';
import type { Entorno } from './config/entorno.js';
import { AvisosModule } from './avisos/avisos.module.js';
import { VencimientoLicencias } from './licencias/vencimiento-licencias.js';
import { VencimientoOrdenes } from './licencias/vencimiento-ordenes.js';
import { PagosModule } from './pagos/pagos.module.js';
import { COLA_MANTENIMIENTO } from './worker/latido.js';
import { MantenimientoProcessor } from './worker/mantenimiento.processor.js';
import { ProgramarTrabajos } from './worker/programar-trabajos.js';

/** Proceso aparte para los trabajos en segundo plano (ver `docs/MODELO-DATOS.md` §5). */
@Module({
  imports: [
    BaseModule,
    AvisosModule,
    PagosModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) => ({
        // BullMQ necesita reintentos ilimitados en la conexión para no perder trabajos si Redis parpadea.
        connection: {
          url: config.get('REDIS_URL', { infer: true }),
          maxRetriesPerRequest: null,
          // Red privada de Railway en IPv6 (ver redis.module.ts).
          family: 0,
        },
        prefix: 'doctrader',
      }),
    }),
    BullModule.registerQueue({ name: COLA_MANTENIMIENTO }),
  ],
  providers: [
    MantenimientoProcessor,
    ProgramarTrabajos,
    AvisosEnvio,
    VencimientoOrdenes,
    VencimientoLicencias,
  ],
})
export class WorkerModule {}
