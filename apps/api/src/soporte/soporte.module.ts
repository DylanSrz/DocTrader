import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module.js';
import {
  AdminRespuestasController,
  AdminSoporteController,
  SoporteController,
} from './soporte.controller.js';
import { SoporteService } from './soporte.service.js';

/** Soporte por tickets: el cliente y la bandeja del admin, con adjuntos, respuestas guardadas y correos. */
@Module({
  imports: [ArchivosModule],
  controllers: [SoporteController, AdminSoporteController, AdminRespuestasController],
  providers: [SoporteService],
  exports: [SoporteService, ArchivosModule],
})
export class SoporteModule {}
