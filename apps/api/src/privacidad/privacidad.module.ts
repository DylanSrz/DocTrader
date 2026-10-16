import { Module } from '@nestjs/common';
import { MisDatosController } from './mis-datos.controller.js';
import { MisDatosService } from './mis-datos.service.js';

@Module({
  controllers: [MisDatosController],
  providers: [MisDatosService],
})
export class PrivacidadModule {}
