import type { INestApplication } from '@nestjs/common';
import { adminConSesion, clienteConSesion, datosCuenta } from './ayudas.js';
import { crearApp } from './crear-app.js';

let app: INestApplication;

beforeAll(async () => {
  app = await crearApp();
});

afterAll(async () => {
  await app.close();
});

describe('clientes en el admin', () => {
  it('lista a todos los registrados, con o sin cuenta, y abre su ficha', async () => {
    const admin = await adminConSesion(app);
    const marca = `zq${Date.now()}`;
    const sinCuenta = await clienteConSesion(app, {
      nombre: 'Rosa Sin Cuenta',
      correo: `${marca}.rosa@correo.co`,
    });
    const conCuenta = await clienteConSesion(app, {
      nombre: 'Tomás Con Cuenta',
      correo: `${marca}.tomas@correo.co`,
    });
    const cuenta = datosCuenta();
    await conCuenta.web.post('/cuentas', cuenta).expect(201);

    // Un cliente no ve la lista.
    await sinCuenta.web.get('/admin/clientes').expect(403);

    const lista = await admin.web.get(`/admin/clientes?q=${marca}`).expect(200);
    expect(lista.body.clientes.map((c: { nombre: string }) => c.nombre).sort()).toEqual([
      'Rosa Sin Cuenta',
      'Tomás Con Cuenta',
    ]);
    expect(lista.body.conteos).toMatchObject({ todos: 2, sin_cuenta: 1, con_licencia: 0 });

    const soloSinCuenta = await admin.web
      .get(`/admin/clientes?filtro=sin_cuenta&q=${marca}`)
      .expect(200);
    expect(soloSinCuenta.body.clientes).toHaveLength(1);
    expect(soloSinCuenta.body.clientes[0]).toMatchObject({ id: sinCuenta.usuario.id, cuentas: 0 });

    // También se busca por el número de la cuenta de trading.
    const porCuenta = await admin.web
      .get(`/admin/clientes?q=${encodeURIComponent(cuenta.numero!)}`)
      .expect(200);
    expect(porCuenta.body.clientes.map((c: { id: string }) => c.id)).toEqual([
      conCuenta.usuario.id,
    ]);

    const ficha = await admin.web.get(`/admin/clientes/${conCuenta.usuario.id}`).expect(200);
    expect(ficha.body.cliente).toMatchObject({ nombre: 'Tomás Con Cuenta', estado: 'ACTIVE' });
    expect(ficha.body.cuentas).toHaveLength(1);
    expect(ficha.body.cuentas[0]).toMatchObject({ numero: cuenta.numero });
    expect(ficha.body.red).toEqual({ primeraLinea: 0, segundaLinea: 0 });
    // La ficha no trae el documento completo: eso sigue siendo una acción aparte, auditada.
    expect(JSON.stringify(ficha.body)).not.toMatch(/cedula"\s*:/);

    await admin.web.get(`/admin/clientes/${admin.usuario.id}`).expect(404);
    await admin.web.get('/admin/clientes?filtro=otro').expect(400);
  });
});
