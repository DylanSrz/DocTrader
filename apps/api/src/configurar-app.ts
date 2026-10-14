import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Entorno } from './config/entorno.js';

/**
 * Configuración de seguridad de la API. Se usa al arrancar y en las pruebas de punta a punta, para probar
 * exactamente lo mismo que corre en producción.
 */
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Entorno, true>>(ConfigService);
  const express = app as NestExpressApplication;

  // Detrás del proxy de Railway o Render: la IP real del cliente viene en X-Forwarded-For.
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.use(
    helmet({
      // La API solo devuelve JSON: una política que no permite cargar nada.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
