import { ZONA_HORARIA } from '@doctrader/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  COLA_MANTENIMIENTO,
  TRABAJO_ALERTAS,
  TRABAJO_ACTIVAR_DIRECCIONES,
  TRABAJO_BORRAR_ARCHIVOS,
  TRABAJO_BORRAR_DATOS,
  TRABAJO_CERRAR_TICKETS,
  TRABAJO_ENVIAR_AVISOS,
  TRABAJO_ESTADOS_LICENCIA,
  TRABAJO_EXPIRAR_ORDENES,
  TRABAJO_LATIDO,
  TRABAJO_LIQUIDAR_COMISION,
  TRABAJO_RECORDATORIOS,
  TRABAJO_VERIFICAR_PAGOS,
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
    // Los pagos reportados se miran en la blockchain cada 30 segundos hasta que tengan sus confirmaciones.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_VERIFICAR_PAGOS,
      { every: 30_000 },
      { name: TRABAJO_VERIFICAR_PAGOS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_ESTADOS_LICENCIA,
      { every: 5 * 60_000 },
      { name: TRABAJO_ESTADOS_LICENCIA, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Una dirección de depósito nueva se activa al cumplir sus 24 horas de espera.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_ACTIVAR_DIRECCIONES,
      { every: 60_000 },
      { name: TRABAJO_ACTIVAR_DIRECCIONES, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Soporte: cada hora se cierran los tickets resueltos que pasaron sus días y se borran los adjuntos sin usar.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_CERRAR_TICKETS,
      { every: 60 * 60_000 },
      { name: TRABAJO_CERRAR_TICKETS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_BORRAR_ARCHIVOS,
      { every: 60 * 60_000 },
      { name: TRABAJO_BORRAR_ARCHIVOS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Recordatorios de vencimiento (7, 3 y 1 día antes): cada hora; la clave de cada correo evita repetirlos.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_RECORDATORIOS,
      { every: 60 * 60_000 },
      { name: TRABAJO_RECORDATORIOS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Comisión del socio: cada hora se cierran las quincenas terminadas (1 al 15 y 16 al fin de mes, hora de Colombia).
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_LIQUIDAR_COMISION,
      { every: 60 * 60_000 },
      { name: TRABAJO_LIQUIDAR_COMISION, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Borrado de datos vencidos según la política de datos: cada día a las 3 a. m. de Colombia.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_BORRAR_DATOS,
      { pattern: '0 3 * * *', tz: ZONA_HORARIA },
      { name: TRABAJO_BORRAR_DATOS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    // Alertas a los admins: pagos sin verificar hace más de una hora y picos de ingresos fallidos.
    await this.mantenimiento.upsertJobScheduler(
      TRABAJO_ALERTAS,
      { every: 15 * 60_000 },
      { name: TRABAJO_ALERTAS, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }
}
