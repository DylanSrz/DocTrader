import { Module } from '@nestjs/common';
import { AdminSocioController } from './socio.controller.js';
import { SocioService } from './socio.service.js';

/** Perfil del socio y liquidación de su comisión. La API lo muestra; el worker liquida las quincenas. */
@Module({
  controllers: [AdminSocioController],
  providers: [SocioService],
  exports: [SocioService],
})
export class SocioModule {}
