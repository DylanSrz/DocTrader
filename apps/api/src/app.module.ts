import { Module } from '@nestjs/common';
import { AccesoModule } from './acceso/acceso.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AvisosModule } from './avisos/avisos.module.js';
import { BaseModule } from './base.module.js';
import { ContenidoModule } from './contenido/contenido.module.js';
import { SaludModule } from './salud/salud.module.js';
import { SesionesModule } from './sesiones/sesiones.module.js';

@Module({
  imports: [
    BaseModule,
    AvisosModule,
    SesionesModule,
    SaludModule,
    ContenidoModule,
    AccesoModule,
    AdminModule,
  ],
})
export class AppModule {}
