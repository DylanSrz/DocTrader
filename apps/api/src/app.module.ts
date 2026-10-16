import { Module } from '@nestjs/common';
import { AccesoModule } from './acceso/acceso.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ArchivosModule } from './archivos/archivos.module.js';
import { AvisosModule } from './avisos/avisos.module.js';
import { BaseModule } from './base.module.js';
import { ContenidoModule } from './contenido/contenido.module.js';
import { LicenciasModule } from './licencias/licencias.module.js';
import { PagosModule } from './pagos/pagos.module.js';
import { PrivacidadModule } from './privacidad/privacidad.module.js';
import { SaludModule } from './salud/salud.module.js';
import { SesionesModule } from './sesiones/sesiones.module.js';
import { SoporteModule } from './soporte/soporte.module.js';
import { SocioModule } from './socio/socio.module.js';

@Module({
  imports: [
    BaseModule,
    AvisosModule,
    SesionesModule,
    SaludModule,
    ContenidoModule,
    AccesoModule,
    AdminModule,
    LicenciasModule,
    PagosModule,
    ArchivosModule,
    SoporteModule,
    SocioModule,
    PrivacidadModule,
  ],
})
export class AppModule {}
