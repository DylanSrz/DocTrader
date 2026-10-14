import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Entorno } from './config/entorno.js';
import { configurarApp } from './configurar-app.js';

const app = await NestFactory.create(AppModule);
configurarApp(app);
const puerto = app.get<ConfigService<Entorno, true>>(ConfigService).get('PORT', { infer: true });
await app.listen(puerto);
new Logger('API').log(`Escuchando en el puerto ${puerto}`);
