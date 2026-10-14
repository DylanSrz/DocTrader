import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

// Sin servidor HTTP: solo el contexto de Nest con las colas.
const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
new Logger('Worker').log('Worker en marcha');
