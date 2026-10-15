import { Module } from '@nestjs/common';
import { AdminContenidoController, PublicoController } from './contenido.controller.js';
import { ContenidoService } from './contenido.service.js';

@Module({
  controllers: [PublicoController, AdminContenidoController],
  providers: [ContenidoService],
  exports: [ContenidoService],
})
export class ContenidoModule {}
