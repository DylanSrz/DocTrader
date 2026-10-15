import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AjustesAdminService } from './ajustes-admin.service.js';
import { CuentasAdminService } from './cuentas-admin.service.js';
import { LicenciasAdminService } from './licencias-admin.service.js';
import {
  AdminAjustesController,
  AdminCuentasController,
  AdminLicenciasController,
} from './operacion.controller.js';
import { ResumenAdminService } from './resumen.service.js';

/** El panel de administración: Hoy, cuentas, licencias y ajustes. Los pagos viven en `PagosModule`. */
@Module({
  controllers: [
    AdminController,
    AdminCuentasController,
    AdminLicenciasController,
    AdminAjustesController,
  ],
  providers: [ResumenAdminService, CuentasAdminService, LicenciasAdminService, AjustesAdminService],
  exports: [AjustesAdminService],
})
export class AdminModule {}
