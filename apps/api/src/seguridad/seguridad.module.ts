import { Global, Module } from '@nestjs/common';
import { CifradoService } from './cifrado.service.js';
import { ContrasenasService } from './contrasenas.service.js';
import { LimitesService } from './limites.service.js';
import { TurnstileService } from './turnstile.service.js';

/** Cifrado, contraseñas, límites de velocidad y Turnstile, compartidos por la API y el worker. */
@Global()
@Module({
  providers: [CifradoService, ContrasenasService, LimitesService, TurnstileService],
  exports: [CifradoService, ContrasenasService, LimitesService, TurnstileService],
})
export class SeguridadModule {}
