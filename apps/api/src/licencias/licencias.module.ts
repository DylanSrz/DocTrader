import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service.js';
import { CuentasController, OrdenesController } from './licencias.controller.js';
import { OrdenesService } from './ordenes.service.js';
import { PrecioBtcService } from './precio-btc.service.js';

@Module({
  controllers: [CuentasController, OrdenesController],
  providers: [CuentasService, OrdenesService, PrecioBtcService],
  exports: [CuentasService],
})
export class LicenciasModule {}
