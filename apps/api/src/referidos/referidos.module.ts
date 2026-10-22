import { Module } from '@nestjs/common';
import { AdminReferidosController, ReferidosController } from './referidos.controller.js';
import { ReferidosService } from './referidos.service.js';

/** Programa de referidos. La API muestra y administra; el worker liquida las quincenas. */
@Module({
  controllers: [ReferidosController, AdminReferidosController],
  providers: [ReferidosService],
  exports: [ReferidosService],
})
export class ReferidosModule {}
