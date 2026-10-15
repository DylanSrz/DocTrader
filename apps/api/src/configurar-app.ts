import { type INestApplication, ValidationPipe, type ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Response } from 'express';
import helmet from 'helmet';
import type { Entorno } from './config/entorno.js';
import { errorDeCampos } from './seguridad/errores.js';
import { FiltroErrores } from './seguridad/filtro-errores.js';
import type { Peticion } from './sesiones/contexto.js';
import { WebMiddleware } from './sesiones/web.middleware.js';

/**
 * Configuración de seguridad de la API. Se usa al arrancar y en las pruebas de punta a punta, para probar
 * exactamente lo mismo que corre en producción.
 */
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Entorno, true>>(ConfigService);
  const express = app as NestExpressApplication;

  if (
    config.get('NODE_ENV', { infer: true }) === 'production' &&
    !config.get('PROXY_SECRET', { infer: true })
  ) {
    throw new Error('Falta PROXY_SECRET: en producción la API solo atiende a la web');
  }

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
  // Antes que todo: solo la web (con el secreto) puede usar la API, y de ella sale la IP real del cliente.
  const web = new WebMiddleware(config);
  express.use((peticion: Peticion, respuesta: Response, siguiente: NextFunction) =>
    web.use(peticion, respuesta, siguiente),
  );
  // Las peticiones de la API son formularios pequeños: nada de cuerpos grandes.
  express.useBodyParser('json', { limit: '32kb' });
  app.useGlobalFilters(new FiltroErrores());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Errores por campo, con los mensajes en español de los DTO, en la misma forma que los de los servicios.
      exceptionFactory: (errores: ValidationError[]) =>
        errorDeCampos(
          Object.fromEntries(
            errores.map((e) => [
              e.property,
              Object.values(e.constraints ?? {})[0] ?? 'No es válido.',
            ]),
          ),
        ),
    }),
  );
  app.enableShutdownHooks();
}
