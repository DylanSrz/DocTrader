import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { AjustesAdminService } from '../admin/ajustes-admin.service.js';
import { AvisosEnvio } from '../avisos/avisos-envio.js';
import { VencimientoLicencias } from '../licencias/vencimiento-licencias.js';
import { VencimientoOrdenes } from '../licencias/vencimiento-ordenes.js';
import { VerificacionPagos } from '../pagos/verificacion-pagos.service.js';
import { REDIS } from '../redis/redis.module.js';
import {
  CLAVE_LATIDO_WORKER,
  COLA_MANTENIMIENTO,
  TRABAJO_ACTIVAR_DIRECCIONES,
  TRABAJO_ENVIAR_AVISOS,
  TRABAJO_ESTADOS_LICENCIA,
  TRABAJO_EXPIRAR_ORDENES,
  TRABAJO_LATIDO,
  TRABAJO_VERIFICAR_PAGOS,
} from './latido.js';

/**
 * Trabajos de mantenimiento: el latido (prueba que el worker está vivo), el envío de correos pendientes y el
 * vencimiento de las órdenes de pago, la verificación de los pagos en la blockchain, los estados de las licencias y
 * la activación de las direcciones de depósito que cumplieron sus 24 horas.
 */
@Processor(COLA_MANTENIMIENTO)
export class MantenimientoProcessor extends WorkerHost {
  private readonly logger = new Logger(MantenimientoProcessor.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly avisos: AvisosEnvio,
    private readonly ordenes: VencimientoOrdenes,
    private readonly pagos: VerificacionPagos,
    private readonly licencias: VencimientoLicencias,
    private readonly ajustes: AjustesAdminService,
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
      case TRABAJO_EXPIRAR_ORDENES:
        await this.ordenes.expirar();
        return;
      case TRABAJO_VERIFICAR_PAGOS:
        await this.pagos.verificarPendientes();
        return;
      case TRABAJO_ESTADOS_LICENCIA:
        await this.licencias.actualizar();
        return;
      case TRABAJO_ACTIVAR_DIRECCIONES:
        await this.ajustes.activarDirecciones();
        return;
      default:
        this.logger.warn(`Trabajo desconocido en ${COLA_MANTENIMIENTO}: ${job.name}`);
    }
  }
}
