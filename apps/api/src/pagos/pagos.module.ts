import { Module } from '@nestjs/common';
import { HuellasPrueba } from '../prueba/huellas.js';
import { AdminPagosController } from './admin-pagos.controller.js';
import { AprobacionPagos } from './aprobacion.service.js';
import { LectorBlockchain } from './lector-blockchain.service.js';
import { VerificacionPagos } from './verificacion-pagos.service.js';

/** Verificación de pagos en la blockchain y su aprobación. La API la usa desde el panel; el worker, cada minuto. */
@Module({
  controllers: [AdminPagosController],
  providers: [LectorBlockchain, AprobacionPagos, VerificacionPagos, HuellasPrueba],
  exports: [LectorBlockchain, AprobacionPagos, VerificacionPagos],
})
export class PagosModule {}
