import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { type Entorno, validarEntorno } from './config/entorno.js';
import { opcionesBaseDeDatos } from './database/data-source.js';
import { RedisModule } from './redis/redis.module.js';

/** Lo que comparten la API y el worker: configuración, base de datos, Redis y auditoría. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // En producción no hay archivo .env: las variables vienen del proveedor.
      envFilePath: '.env',
      // Las pruebas automáticas usan solo las variables que les da Vitest, nunca el .env de desarrollo.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validarEntorno,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) =>
        opcionesBaseDeDatos(
          config.get('DATABASE_URL', { infer: true }),
          config.get('DATABASE_SSL', { infer: true }),
        ),
    }),
    RedisModule,
    AuditoriaModule,
  ],
})
export class BaseModule {}
