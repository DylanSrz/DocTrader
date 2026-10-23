import { aUnidadesBase } from '@doctrader/shared';
import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditLog, Notification } from '../src/database/entidades/index.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { AvisosService } from '../src/avisos/avisos.service.js';
import { VencimientoLicencias } from '../src/licencias/vencimiento-licencias.js';
import { LectorBlockchain, SinLlaveBinance } from '../src/pagos/lector-blockchain.service.js';
import { ErrorProveedor, type Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { comoLaWeb, crearApp } from './crear-app.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';

let app: INestApplication;
let fuente: DataSource;
let verificacion: VerificacionPagos;

/** Lo que "dice la blockchain" en cada prueba: una lectura por hash, o un error del proveedor. */
const blockchain = new Map<string, Lectura | 'ERROR' | 'SIN_LLAVE'>();

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
          if (lectura === 'SIN_LLAVE') throw new SinLlaveBinance();
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

let ultimaTransferencia = 421_231_346_716 + Math.floor(Math.random() * 1_000_000_000);
const transferenciaNueva = () => String((ultimaTransferencia += 1));

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
      // En USDT se cobra el precio exacto: USD 120 son 120 USDT.
      monto: '120',
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
      commission_bp: 2_000,
      commission_usd_cents: 2_400,
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
    // En USDT las dos órdenes piden el precio exacto: el monto ya no distingue a quién pertenece el pago.
    expect(trampa.body.monto).toBe(orden.body.monto);

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
    // La víctima tenía una orden abierta por el mismo monto: el pago queda por confirmar, nunca verificado, y no se
    // aprueba sin que un admin confirme quién lo envió.
    expect(revision.verificacion).toBe('POR_CONFIRMAR');
    expect(revision.chequeos.find((c: { clave: string }) => c.clave === 'UNICO')).toMatchObject({
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

  it('un pago entre cuentas de Binance se reporta con su número de transferencia y se verifica', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const transferencia = transferenciaNueva();
    blockchain.set(`binance:${transferencia}`, {
      ...exacto()({
        direccion: orden.body.direccion,
        unidades: aUnidadesBase(orden.body.monto, 'USDT'),
      }),
      bloque: null,
      confirmaciones: Number.MAX_SAFE_INTEGER,
      remitentes: [],
      interna: true,
    } as Lectura);

    // Un código que no es hash ni número de transferencia no se acepta.
    const malo = await cliente.web
      .post(`/ordenes/${orden.body.numero}/reportar`, { hash: 'abc123' })
      .expect(400);
    expect(malo.body.campos.hash).toContain('Binance');
    // Se pega tal como lo muestra Binance.
    await cliente.web
      .post(`/ordenes/${orden.body.numero}/reportar`, {
        hash: `Off-chain Transfer ${transferencia}`,
      })
      .expect(200);
    await verificacion.verificarPendientes();

    const revision = await pendiente(admin, orden.body.numero);
    expect(revision).toMatchObject({
      verificacion: 'VERIFICADA',
      hash: `Transferencia interna de Binance ${transferencia}`,
      enlaceExplorador: null,
    });
    expect(revision.chequeos.map((c: { texto: string }) => c.texto)).toEqual([
      'El número de la transferencia de Binance no se había usado',
      'Llegó a la dirección de la orden, en USDT, por transferencia interna de Binance',
      'El monto es igual al de la orden',
      'Se envió después de crear la orden',
      'Binance ya la acreditó (no necesita confirmaciones)',
    ]);
    const propia = await cliente.web.get(`/ordenes/${orden.body.numero}`).expect(200);
    expect(propia.body).toMatchObject({
      hash: `Transferencia interna de Binance ${transferencia}`,
      enlaceExplorador: null,
    });

    // El mismo número no sirve para otra orden.
    const otraCuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const otra = await cliente.web
      .post('/ordenes', { cuentaId: otraCuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const repetido = await cliente.web
      .post(`/ordenes/${otra.body.numero}/reportar`, { hash: transferencia })
      .expect(400);
    expect(repetido.body.campos.hash).toContain('ya se reportó');
  });

  it('sin la llave de Binance el pago interno queda para revisión manual y se avisa a los admins', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const transferencia = transferenciaNueva();
    blockchain.set(`binance:${transferencia}`, 'SIN_LLAVE');
    await cliente.web
      .post(`/ordenes/${orden.body.numero}/reportar`, { hash: transferencia })
      .expect(200);
    await verificacion.verificarPendientes();
    await verificacion.verificarPendientes();

    const revision = await pendiente(admin, orden.body.numero);
    expect(revision).toMatchObject({
      verificacion: 'ERROR_PROVEEDOR',
      nota: expect.stringContaining('Historial de depósitos'),
    });
    const avisos = (await fuente.query(
      `SELECT payload FROM notifications WHERE template = 'pago-por-revisar' AND payload->>'orden' = $1`,
      [orden.body.numero],
    )) as { payload: Record<string, string> }[];
    // Uno por admin, una sola vez aunque la verificación vuelva a correr.
    expect(avisos.length).toBeGreaterThan(0);
    const admins = (await fuente.query(
      `SELECT count(*)::int AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
    )) as { n: number }[];
    expect(avisos).toHaveLength(admins[0]!.n);
    await admin.web.post(`/admin/pagos/${orden.body.numero}/aprobar`, { forzar: true }).expect(200);
  });

  it('un admin registra a mano el pago de una orden vencida, con su código y una referencia', async () => {
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const vieja = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    await fuente.query(
      `UPDATE payment_orders
          SET status = 'EXPIRADA', created_at = now() - interval '3 hours',
              expires_at = now() - interval '2 hours'
        WHERE number = $1`,
      [vieja.body.numero],
    );
    // El cliente ya pidió otra orden para la misma licencia: se cancela al registrar el pago de la vieja.
    const nueva = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const transferencia = transferenciaNueva();
    const datos = {
      motivo: 'Pagó desde Binance; revisado en el historial de depósitos.',
      referencia: `Off-chain Transfer ${transferencia}`,
    };

    await cliente.web.post(`/admin/pagos/${vieja.body.numero}/manual`, datos).expect(403);
    const fresco = await adminConSesion(app);
    const sinCodigo = await fresco.web
      .post(`/admin/pagos/${vieja.body.numero}/manual`, datos)
      .expect(403);
    expect(sinCodigo.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await fresco.confirmar();
    const mala = await fresco.web
      .post(`/admin/pagos/${vieja.body.numero}/manual`, { ...datos, referencia: 'xyz' })
      .expect(400);
    expect(mala.body.campos.referencia).toBeDefined();
    await fresco.web.post(`/admin/pagos/${vieja.body.numero}/manual`, datos).expect(200);

    const ordenes = (await fuente.query(
      `SELECT number, status, tx_hash, approval_mode FROM payment_orders WHERE number = ANY($1)`,
      [[vieja.body.numero, nueva.body.numero]],
    )) as { number: string; status: string; tx_hash: string; approval_mode: string }[];
    expect(ordenes.find((o) => o.number === vieja.body.numero)).toMatchObject({
      status: 'APROBADA',
      tx_hash: `binance:${transferencia}`,
      approval_mode: 'MANUAL',
    });
    expect(ordenes.find((o) => o.number === nueva.body.numero)?.status).toBe('CANCELADA');
    const { body } = await cliente.web.get(`/cuentas/${cuenta.body.id}`).expect(200);
    expect(body.licencia.estado).toBe('ACTIVA');
    const registro = await fuente.getRepository(AuditLog).findOneOrFail({
      where: { action: 'pago.registrado_manual', actorId: fresco.usuario.id },
      order: { id: 'DESC' },
    });
    expect(registro.metadata).toMatchObject({
      numero: vieja.body.numero,
      motivo: datos.motivo,
      referencia: `binance:${transferencia}`,
      estadoAnterior: 'EXPIRADA',
      canceladaOtra: nueva.body.numero,
    });

    // Una orden ya aprobada no se registra otra vez.
    const otraVez = await fresco.web
      .post(`/admin/pagos/${vieja.body.numero}/manual`, datos)
      .expect(409);
    expect(otraVez.body.codigo).toBe('NO_REGISTRABLE');
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
