import { randomInt } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

/** Levanta la API completa, con la misma configuración de seguridad que en producción. */
export async function crearApp(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return app;
}

/** Una IP distinta para cada "cliente" de las pruebas, para que los límites de velocidad no se crucen. */
export function ipAleatoria(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

/**
 * Peticiones como las haría el servidor de la web: con el secreto compartido, la IP y el navegador del cliente,
 * y la sesión (si hay) en `Authorization`.
 */
export function comoLaWeb(
  app: INestApplication,
  opciones: { ip?: string; token?: string; agente?: string } = {},
) {
  const ip = opciones.ip ?? ipAleatoria();
  const firmar = (prueba: request.Test) => {
    prueba
      .set('x-doctrader-proxy', process.env.PROXY_SECRET!)
      .set('x-doctrader-ip', ip)
      .set('x-doctrader-agente', opciones.agente ?? 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0');
    if (opciones.token) prueba.set('Authorization', `Bearer ${opciones.token}`);
    return prueba;
  };
  const servidor = app.getHttpServer();
  return {
    get: (ruta: string) => firmar(request(servidor).get(ruta)),
    post: (ruta: string, cuerpo?: object) =>
      firmar(request(servidor).post(ruta)).send(cuerpo ?? {}),
    put: (ruta: string, cuerpo?: object) => firmar(request(servidor).put(ruta)).send(cuerpo ?? {}),
    delete: (ruta: string) => firmar(request(servidor).delete(ruta)),
  };
}
