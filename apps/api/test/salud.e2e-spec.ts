import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp } from './crear-app.js';

describe('GET /salud', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde ok con la base de datos y Redis conectados', async () => {
    const respuesta = await request(app.getHttpServer()).get('/salud').expect(200);
    expect(respuesta.body).toMatchObject({ estado: 'ok', baseDeDatos: 'ok', redis: 'ok' });
  });

  it('envía los encabezados de seguridad', async () => {
    const respuesta = await request(app.getHttpServer()).get('/salud');
    expect(respuesta.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(respuesta.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  it('solo permite peticiones con credenciales desde la web', async () => {
    const permitida = await request(app.getHttpServer())
      .get('/salud')
      .set('Origin', 'http://localhost:3000');
    expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const ajena = await request(app.getHttpServer())
      .get('/salud')
      .set('Origin', 'https://otro-sitio.com');
    expect(ajena.headers['access-control-allow-origin']).not.toBe('https://otro-sitio.com');
  });
});

describe('forma de los errores', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('una ruta que no existe responde con código y mensaje, aunque traiga el secreto de la web', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/auth/no-existe')
      .set('x-doctrader-proxy', process.env.PROXY_SECRET!)
      .expect(404);
    expect(respuesta.body).toEqual({ codigo: 'NO_ENCONTRADO', mensaje: 'No encontrado.' });
  });
});
