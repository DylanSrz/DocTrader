import { Module } from '@nestjs/common';
import { Almacen, FabricaAlmacen } from './almacen.js';
import { ArchivosController } from './archivos.controller.js';
import { ArchivosService } from './archivos.service.js';
import { FirmaArchivos } from './firma.js';

/** Adjuntos de soporte: almacenamiento privado (R2), subida directa desde el navegador y enlaces firmados. */
@Module({
  controllers: [ArchivosController],
  providers: [
    FirmaArchivos,
    FabricaAlmacen,
    { provide: Almacen, inject: [FabricaAlmacen], useFactory: (f: FabricaAlmacen) => f.crear() },
    ArchivosService,
  ],
  exports: [ArchivosService],
})
export class ArchivosModule {}
