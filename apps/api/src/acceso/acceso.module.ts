import { Module } from '@nestjs/common';
import { SesionesModule } from '../sesiones/sesiones.module.js';
import { AccesoController } from './acceso.controller.js';
import { AccesoService } from './acceso.service.js';

@Module({
  imports: [SesionesModule],
  controllers: [AccesoController],
  providers: [AccesoService],
})
export class AccesoModule {}
