import { Module } from '@nestjs/common';
import { BaseModule } from './base.module.js';
import { SaludModule } from './salud/salud.module.js';

@Module({
  imports: [BaseModule, SaludModule],
})
export class AppModule {}
