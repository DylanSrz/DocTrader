import { Global, Module } from '@nestjs/common';
import { AvisosService } from './avisos.service.js';

@Global()
@Module({ providers: [AvisosService], exports: [AvisosService] })
export class AvisosModule {}
