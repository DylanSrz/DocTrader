import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LimiteGlobalGuard } from './limite-global.guard.js';
import { SesionGuard } from './sesion.guard.js';
import { SesionesService } from './sesiones.service.js';

/**
 * Sesiones y las guardas globales (límite general y acceso). El filtro de peticiones que no vienen de la web
 * (`WebMiddleware`) se monta en `configurarApp`, antes que todo lo demás.
 */
@Module({
  providers: [
    SesionesService,
    { provide: APP_GUARD, useClass: LimiteGlobalGuard },
    { provide: APP_GUARD, useClass: SesionGuard },
  ],
  exports: [SesionesService],
})
export class SesionesModule {}
