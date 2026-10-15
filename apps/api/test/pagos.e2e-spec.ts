import { aUnidadesBase } from '@doctrader/shared';
import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditLog, Notification } from '../src/database/entidades/index.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { AvisosService } from '../src/avisos/avisos.service.js';
import { VencimientoLicencias } from '../src/licencias/vencimiento-licencias.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import { ErrorProveedor, type Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { comoLaWeb, crearApp } from './crear-app.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';

let app: INestApplication;
let fuente: DataSource;
let verificacion: VerificacionPagos;

/** Lo que "dice la blockchain" en cada prueba: una lectura por hash, o un error del proveedor. */
const blockchain = new Map<string, Lectura | 'ERROR'>();

beforeAll(async () => {
  app = await crearApp((c) =>
    c
      .overrideProvider(PrecioBtcService)
      .useValue({ cotizar: async () => 12_540_000n })
      .overrideProvider(LectorBlockchain)
      .useValue({
        leer: async (_red: string, hash: string) => {
          const lectura = blockchain.get(hash) ?? { encontrada: false };
          if (lectura === 'ERROR') throw new ErrorProveedor('Los dos proveedores fallaron');
          return { lectura, proveedor: 'Prueba' };
        },
      }),
  );
  fuente = app.get(getDataSourceToken());
  verificacion = app.get(VerificacionPagos);
});

afterAll(async () => {
  await app.close();
});

type Cliente = Awaited<ReturnType<typeof clienteConSesion>>;
type Admin = Awaited<ReturnType<typeof adminConSesion>>;

/** El cliente pide una orden y reporta su hash; la blockchain muestra lo que se indique. */
async function pagar(
  cliente: Cliente,
  cuentaId: string,
  plan: string,
  lectura: (orden: { direccion: string; unidades: bigint }) => Lectura | 'ERROR',
) {
  const orden = await cliente.web.post('/ordenes', { cuentaId, plan, moneda: 'USDT' }).expect(201);
  const hash = hashNuevo();
  blockchain.set(
    hash,
    lectura({
      direccion: orden.body.direccion,
      unidades: aUnidadesBase(orden.body.monto, 'USDT'),
    }),
  );
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await verificacion.verificarPendientes();
  return { numero: orden.body.numero as string, hash };
}

const exacto =
  (cambios: Partial<Extract<Lectura, { encontrada: true }>> = {}) =>
  (o: { direccion: string; unidades: bigint }): Lectura => ({
    encontrada: true,
    exitosa: true,
    hora: new Date(),
    bloque: 100,
    confirmaciones: 25,
    pagos: [{ direccion: o.direccion, unidades: o.unidades }],
    otraMoneda: false,
    remitentes: ['TKfz7Pu3jtxWrfHzVeozQjXsb3RfuUHGE2'],
    ...cambios,
  });

async function pendiente(admin: Admin, numero: string) {
  const lista = await admin.web.get('/admin/pagos').expect(200);
  return lista.body.porRevisar.find((p: { numero: string }) => p.numero === numero);
}

const unMes = (desde: Date) => {
  const fin = new Date(desde);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return fin;
};

describe('verificación y aprobación de pagos', () => {
  let admin: Admin;

  beforeAll(async () => {
    admin = await adminConSesion(app);
  });

  it('un pago exacto con sus confirmaciones queda verificado; al aprobarlo la licencia queda activa', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const antes = new Date();
    const { numero } = await pagar(cliente, cuenta.body.id, 'MENSUAL', exacto());

    const revision = await pendiente(admin, numero);
    expect(revision).toMatchObject({
      verificacion: 'VERIFICADA',
      cliente: { nombre: 'Laura Gómez Restrepo' },
      monto: expect.stringMatching(/^119\.\d{2}$/),
      confirmaciones: 25,
      confirmacionesNecesarias: 20,
      proveedor: 'Prueba',
    });
    expect(revision.recibido).toBe(revision.monto);
    expect(revision.chequeos.map((c: { estado: string }) => c.estado)).toEqual([
      'OK',
      'OK',
      'OK',
      'OK',
      'OK',
    ]);

    await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(200);

    const { body } = await cliente.web.get(`/cuentas/${cuenta.body.id}`).expect(200);
    expect(body.conexion).toBe('POR_CONECTAR');
    expect(body.licencia).toMatchObject({ estado: 'ACTIVA', plan: { codigo: 'MENSUAL' } });
    expect(body.licencia.periodos).toHaveLength(1);
    const fin = new Date(body.licencia.fin);
    // Un mes de calendario desde la aprobación (en hora de Colombia; un día de margen por la zona horaria).
    expect(Math.abs(fin.getTime() - unMes(antes).getTime())).toBeLessThan(86_400_000 * 1.1);
    expect(new Date(body.licencia.finGracia).getTime() - fin.getTime()).toBe(3 * 86_400_000);

    const [orden] = (await fuente.query(
      `SELECT status, approval_mode, commission_bp, commission_usd_cents, decided_by
         FROM payment_orders WHERE number = $1`,
      [numero],
    )) as Record<string, unknown>[];
    expect(orden).toMatchObject({
      status: 'APROBADA',
      approval_mode: 'MANUAL',
      commission_bp: 1_000,
      commission_usd_cents: 1_200,
      decided_by: admin.usuario.id,
    });
    const correo = await fuente
      .getRepository(Notification)
      .findOneByOrFail({ recipient: cliente.correo, template: 'pago-aprobado' });
    expect(correo.payload).toMatchObject({ orden: numero, plan: 'mensual', conectar: 'si' });
    expect(
      await fuente
        .getRepository(AuditLog)
        .existsBy({ action: 'pago.aprobado', actorId: admin.usuario.id }),
    ).toBe(true);

    // Aprobar dos veces no se puede.
    const otra = await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(409);
    expect(otra.body.codigo).toBe('NO_REVISABLE');
  });

  it('pasar a semestral con la licencia activa suma 6 meses al vencimiento actual', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const primera = await pagar(cliente, cuenta.body.id, 'MENSUAL', exacto());
    await admin.web.post(`/admin/pagos/${primera.numero}/aprobar`, {}).expect(200);
    const antes = (await cliente.web.get(`/cuentas/${cuenta.body.id}`)).body.licencia;

    const cambio = await pagar(cliente, cuenta.body.id, 'SEMESTRAL', exacto());
    await admin.web.post(`/admin/pagos/${cambio.numero}/aprobar`, {}).expect(200);

    const despues = (await cliente.web.get(`/cuentas/${cuenta.body.id}`)).body.licencia;
    expect(despues.plan.codigo).toBe('SEMESTRAL');
    expect(despues.inicio).toBe(antes.inicio);
    expect(despues.periodos.map((p: { tipo: string }) => p.tipo)).toEqual([
      'NUEVA',
      'CAMBIO_DE_PLAN',
    ]);
    expect(despues.periodos[1].inicio).toBe(antes.fin);
    const meses =
      (new Date(despues.fin).getUTCFullYear() - new Date(antes.fin).getUTCFullYear()) * 12 +
      new Date(despues.fin).getUTCMonth() -
      new Date(antes.fin).getUTCMonth();
    expect(meses).toBe(6);
  });

  it('nadie puede reportar como suyo el pago de otra orden, aunque llegue a la misma dirección', async () => {
    const victima = await clienteConSesion(app);
    const atacante = await clienteConSesion(app);
    const suya = await victima.web.post('/cuentas', datosCuenta()).expect(201);
    const ajena = await atacante.web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await victima.web
      .post('/ordenes', { cuentaId: suya.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const trampa = await atacante.web
      .post('/ordenes', { cuentaId: ajena.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    expect(trampa.body.monto).not.toBe(orden.body.monto);

    // La víctima paga su monto exacto; el atacante ve el hash en la blockchain y lo reporta primero.
    const hash = hashNuevo();
    blockchain.set(
      hash,
      exacto()({
        direccion: orden.body.direccion,
        unidades: aUnidadesBase(orden.body.monto, 'USDT'),
      }),
    );
    await atacante.web.post(`/ordenes/${trampa.body.numero}/reportar`, { hash }).expect(200);
    await verificacion.verificarPendientes();
    const revision = await pendiente(admin, trampa.body.numero);
    // El monto de la víctima no es el de la trampa: queda menor (incompleto) o mayor (no coincide), nunca verificado.
    expect(['MONTO_INCOMPLETO', 'NO_COINCIDE']).toContain(revision.verificacion);
    expect(revision.chequeos.find((c: { clave: string }) => c.clave === 'MONTO')).toMatchObject({
      estado: 'FALLA',
    });
    await admin.web.post(`/admin/pagos/${trampa.body.numero}/aprobar`, {}).expect(409);
  });

  it('un monto incompleto no se aprueba sin forzar; se rechaza con motivo y le llega al cliente', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const { numero } = await pagar(cliente, cuenta.body.id, 'MENSUAL', (o) =>
      exacto({ pagos: [{ direccion: o.direccion, unidades: o.unidades - 5_000_000n }] })(o),
    );
    const revision = await pendiente(admin, numero);
    expect(revision.verificacion).toBe('MONTO_INCOMPLETO');
    expect(Number(revision.recibido)).toBeCloseTo(Number(revision.monto) - 5, 2);

    const sinForzar = await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(409);
    expect(sinForzar.body.codigo).toBe('NO_VERIFICADO');

    const corto = await admin.web
      .post(`/admin/pagos/${numero}/rechazar`, { motivo: 'no' })
      .expect(400);
    expect(corto.body.codigo).toBe('DATOS_INVALIDOS');
    await admin.web
      .post(`/admin/pagos/${numero}/rechazar`, {
        motivo: 'Llegaron 115 USDT de 120. Envía los 5 que faltan y escríbenos.',
      })
      .expect(200);

    const vista = await cliente.web.get(`/ordenes/${numero}`).expect(200);
    expect(vista.body).toMatchObject({
      estado: 'RECHAZADA',
      motivoRechazo: expect.stringMatching(/115/),
    });
    const correo = await fuente
      .getRepository(Notification)
      .findOneByOrFail({ recipient: cliente.correo, template: 'pago-rechazado' });
    expect(correo.payload.motivo).toMatch(/faltan/);
    // La cuenta sigue sin pagar y se puede crear otra orden.
    await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
  });

  it('mientras faltan confirmaciones espera; al completarlas queda verificada', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const { numero, hash } = await pagar(
      cliente,
      cuenta.body.id,
      'MENSUAL',
      exacto({ confirmaciones: 5 }),
    );
    expect((await pendiente(admin, numero)).verificacion).toBe('ESPERANDO_CONFIRMACIONES');
    const antes = await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(409);
    expect(antes.body.codigo).toBe('ESPERANDO_CONFIRMACIONES');

    const lectura = blockchain.get(hash) as Extract<Lectura, { encontrada: true }>;
    blockchain.set(hash, { ...lectura, confirmaciones: 21 });
    await admin.web.post(`/admin/pagos/${numero}/verificar`).expect(200);
    expect((await pendiente(admin, numero)).verificacion).toBe('VERIFICADA');
  });

  it('si los proveedores fallan queda "error de proveedor" y no se aprueba sin forzar', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const { numero } = await pagar(cliente, cuenta.body.id, 'MENSUAL', () => 'ERROR');
    const revision = await pendiente(admin, numero);
    expect(revision).toMatchObject({ verificacion: 'ERROR_PROVEEDOR', error: expect.any(String) });
    await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(409);
    // El admin lo revisó en el explorador: puede aprobarlo de todos modos.
    await admin.web.post(`/admin/pagos/${numero}/aprobar`, { forzar: true }).expect(200);
    const auditoria = await fuente.getRepository(AuditLog).findOneOrFail({
      where: { action: 'pago.aprobado' },
      order: { id: 'DESC' },
    });
    expect(auditoria.metadata).toMatchObject({ forzado: true, verificacion: 'ERROR_PROVEEDOR' });
  });

  it('la aprobación automática exige confirmar al encenderla y aprueba sola los pagos verificados', async () => {
    const sinConfirmar = await admin.web
      .put('/admin/pagos/aprobacion-automatica', { activa: true })
      .expect(403);
    expect(sinConfirmar.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await admin.confirmar();
    await admin.web.put('/admin/pagos/aprobacion-automatica', { activa: true }).expect(200);
    try {
      const cliente = await clienteConSesion(app);
      const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
      const { numero } = await pagar(cliente, cuenta.body.id, 'MENSUAL', exacto());
      const [orden] = (await fuente.query(
        `SELECT status, approval_mode, decided_by FROM payment_orders WHERE number = $1`,
        [numero],
      )) as Record<string, unknown>[];
      expect(orden).toEqual({ status: 'APROBADA', approval_mode: 'AUTO', decided_by: null });

      // Un pago con monto incompleto sigue esperando al admin.
      const otra = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
      const incompleto = await pagar(cliente, otra.body.id, 'MENSUAL', (o) =>
        exacto({ pagos: [{ direccion: o.direccion, unidades: 1n }] })(o),
      );
      expect((await pendiente(admin, incompleto.numero)).verificacion).toBe('MONTO_INCOMPLETO');
    } finally {
      // Apagarla no pide confirmación.
      await admin.web.put('/admin/pagos/aprobacion-automatica', { activa: false }).expect(200);
    }
    expect((await admin.web.get('/admin/pagos')).body.aprobacionAutomatica).toBe(false);
  });

  it('un cliente no ve los pagos de todos ni los aprueba', async () => {
    const cliente = await clienteConSesion(app);
    await cliente.web.get('/admin/pagos').expect(403);
    await cliente.web.post('/admin/pagos/DTP-000001/aprobar', {}).expect(403);
    await comoLaWeb(app).get('/admin/pagos').expect(401);
  });
});

describe('vencimiento de las licencias', () => {
  it('activa → en gracia → vencida; la cuenta conectada pasa a "por desconectar"', async () => {
    const admin = await adminConSesion(app);
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const { numero } = await pagar(cliente, cuenta.body.id, 'MENSUAL', exacto());
    await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(200);
    await fuente.query(
      `UPDATE trading_accounts SET connection_status = 'CONECTADA' WHERE id = $1`,
      [cuenta.body.id],
    );
    const tareas = new VencimientoLicencias(fuente, app.get(AvisosService));

    await fuente.query(
      `UPDATE licenses SET ends_at = now() - interval '1 hour', grace_ends_at = now() + interval '2 days',
         starts_at = now() - interval '31 days' WHERE trading_account_id = $1`,
      [cuenta.body.id],
    );
    await tareas.actualizar();
    let vista = (await cliente.web.get(`/cuentas/${cuenta.body.id}`)).body;
    expect(vista.licencia.estado).toBe('EN_GRACIA');
    expect(vista.conexion).toBe('CONECTADA');

    // Renovar en la gracia: los días se suman desde el vencimiento (los de gracia cuentan como usados).
    const finAnterior = vista.licencia.fin as string;
    const renovacion = await pagar(cliente, cuenta.body.id, 'MENSUAL', exacto());
    await admin.web.post(`/admin/pagos/${renovacion.numero}/aprobar`, {}).expect(200);
    vista = (await cliente.web.get(`/cuentas/${cuenta.body.id}`)).body;
    expect(vista.licencia.estado).toBe('ACTIVA');
    const renovado = vista.licencia.periodos.find((p: { tipo: string }) => p.tipo === 'RENOVACION');
    expect(renovado.inicio).toBe(finAnterior);

    await fuente.query(
      `UPDATE licenses SET ends_at = now() - interval '4 days', grace_ends_at = now() - interval '1 hour',
         starts_at = now() - interval '40 days' WHERE trading_account_id = $1`,
      [cuenta.body.id],
    );
    await tareas.actualizar();
    vista = (await cliente.web.get(`/cuentas/${cuenta.body.id}`)).body;
    expect(vista.licencia.estado).toBe('VENCIDA');
    expect(vista.conexion).toBe('POR_DESCONECTAR');
  });
});
