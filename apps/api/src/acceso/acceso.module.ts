import { Module } from '@nestjs/common';
import { ContenidoModule } from '../contenido/contenido.module.js';
import { SesionesModule } from '../sesiones/sesiones.module.js';
import { AccesoController } from './acceso.controller.js';
import { AccesoService } from './acceso.service.js';

@Module({
  imports: [SesionesModule, ContenidoModule],
  controllers: [AccesoController],
  providers: [AccesoService],
})
export class AccesoModule {}
