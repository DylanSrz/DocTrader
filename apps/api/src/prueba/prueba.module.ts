import { Module } from '@nestjs/common';
import { HuellasPrueba } from './huellas.js';
import { AdminPruebasController, PruebaController } from './prueba.controller.js';
import { PruebaService } from './prueba.service.js';
import { FabricaSms, ProveedorSms } from './sms.js';
import { TelefonoService } from './telefono.service.js';

/** Licencia de prueba: verificación del teléfono por SMS, solicitudes y el control antiabuso. */
@Module({
  controllers: [PruebaController, AdminPruebasController],
  providers: [
    FabricaSms,
    { provide: ProveedorSms, inject: [FabricaSms], useFactory: (f: FabricaSms) => f.crear() },
    HuellasPrueba,
    TelefonoService,
    PruebaService,
  ],
  exports: [HuellasPrueba],
})
export class PruebaModule {}
