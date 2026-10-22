import { aUnidadesBase } from '@doctrader/shared';
import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import type { Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { ReferidosService } from '../src/referidos/referidos.service.js';
import { SocioService } from '../src/socio/socio.service.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';
import { comoLaWeb, crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
const blockchain = new Map<string, Lectura>();

/** Direcciones de Tron reales (con su suma de control): la de depósito de la semilla y el contrato de USDT. */
const DIRECCION_1 = 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x';
const DIRECCION_2 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

beforeAll(async () => {
  app = await crearApp((c) =>
    c
      .overrideProvider(PrecioBtcService)
      .useValue({ cotizar: async () => 12_540_000n })
      .overrideProvider(LectorBlockchain)
      .useValue({
        leer: async (_red: string, hash: string) => ({
          lectura: blockchain.get(hash) ?? { encontrada: false },
          proveedor: 'Prueba',
        }),
      }),
  );
  fuente = app.get(getDataSourceToken());
});

afterAll(async () => {
  // Las ventas que estas pruebas corrieron al pasado no deben quedar para la liquidación del socio de otra prueba.
  await app.get(SocioService).liquidar();
  await app.close();
});

type Cliente = Awaited<ReturnType<typeof clienteConSesion>>;
type Admin = Awaited<ReturnType<typeof adminConSesion>>;

/** El cliente agrega una cuenta, paga la mensual en USDT y un admin aprueba el pago. Devuelve el número de orden. */
async function comprar(cliente: Cliente, admin: Admin): Promise<string> {
  const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
  const orden = await cliente.web
    .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
    .expect(201);
  const hash = hashNuevo();
  blockchain.set(hash, {
    encontrada: true,
    exitosa: true,
    hora: new Date(),
    bloque: 100,
    confirmaciones: 25,
    pagos: [{ direccion: orden.body.direccion, unidades: aUnidadesBase(orden.body.monto, 'USDT') }],
    otraMoneda: false,
    remitentes: [],
  });
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await app.get(VerificacionPagos).verificarPendientes();
  await admin.web.post(`/admin/pagos/${orden.body.numero}/aprobar`, {}).expect(200);
  return orden.body.numero as string;
}

async function referidoPor(usuarioId: string): Promise<string | null> {
  const [fila] = (await fuente.query(`SELECT referred_by FROM users WHERE id = $1`, [
    usuarioId,
  ])) as { referred_by: string | null }[];
  return fila!.referred_by;
}

async function comision(numero: string) {
  const [fila] = (await fuente.query(
    `SELECT referrer_id, referral_bp, referral_usd_cents, referral_payout_id FROM payment_orders WHERE number = $1`,
    [numero],
  )) as {
    referrer_id: string | null;
    referral_bp: number | null;
    referral_usd_cents: number | null;
    referral_payout_id: string | null;
  }[];
  return fila!;
}

/** Corre la venta a una quincena ya terminada, para que la liquidación la tome. */
async function alPasado(numero: string, fecha = '2025-03-05T10:00:00-05:00') {
  await fuente.query(`UPDATE payment_orders SET decided_at = $2 WHERE number = $1`, [
    numero,
    fecha,
  ]);
}

async function pagosDe(referidorId: string) {
  return (await fuente.query(
    `SELECT id, to_char(period_start, 'YYYY-MM-DD') AS inicio, sales_count, commission_usd_cents::int AS comision,
            usdt_address, status, tx_hash
       FROM referral_payouts WHERE referrer_id = $1 ORDER BY created_at`,
    [referidorId],
  )) as {
    id: string;
    inicio: string;
    sales_count: number;
    comision: number;
    usdt_address: string;
    status: string;
    tx_hash: string | null;
  }[];
}

async function correo(usuarioId: string, plantilla: string) {
  const [fila] = (await fuente.query(
    `SELECT payload FROM notifications WHERE user_id = $1 AND template = $2 ORDER BY created_at DESC LIMIT 1`,
    [usuarioId, plantilla],
  )) as { payload: Record<string, string> }[];
  return fila?.payload ?? null;
}

describe('referidos', () => {
  let admin: Admin;
  let ana: Cliente;
  let codigoAna: string;

  beforeAll(async () => {
    admin = await adminConSesion(app);
    ana = await clienteConSesion(app, { nombre: 'Ana María Torres' });
  });

  it('sin licencia no se refiere; con licencia hay código y el registro queda atribuido', async () => {
    const antes = await ana.web.get('/referidos/mio').expect(200);
    expect(antes.body).toMatchObject({ puedeReferir: false, via: null, perfil: null });
    expect(antes.body.programa).toMatchObject({ activo: true, porcentajeBp: 2000 });

    await comprar(ana, admin);
    const vista = await ana.web.get('/referidos/mio').expect(200);
    expect(vista.body).toMatchObject({ puedeReferir: true, via: 'LICENCIA' });
    codigoAna = vista.body.perfil.codigo as string;
    expect(codigoAna).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    // El código no cambia al volver a entrar.
    expect((await ana.web.get('/referidos/mio').expect(200)).body.perfil.codigo).toBe(codigoAna);

    // "Te invitó" en el registro: sin sesión, con el código escrito como sea.
    const invitacion = await comoLaWeb(app)
      .get(`/referidos/codigo/${codigoAna.slice(0, 4).toLowerCase()}-${codigoAna.slice(4)}`)
      .expect(200);
    expect(invitacion.body).toEqual({ nombre: 'Ana M.' });
    await comoLaWeb(app).get('/referidos/codigo/ZZZZZZZZ').expect(404);

    const bruno = await clienteConSesion(app, {
      nombre: 'Bruno Pérez',
      codigoReferido: ` ${codigoAna.toLowerCase()} `,
    });
    expect(await referidoPor(bruno.usuario.id)).toBe(ana.usuario.id);
    // Un código que no existe no impide registrarse.
    const carla = await clienteConSesion(app, { codigoReferido: 'ZZZZ2222' });
    expect(await referidoPor(carla.usuario.id)).toBeNull();

    const conReferido = await ana.web.get('/referidos/mio').expect(200);
    expect(conReferido.body.referidos).toEqual([
      expect.objectContaining({ nombre: 'Bruno P.', estado: 'REGISTRADO' }),
    ]);
    expect(conReferido.body.cifras).toMatchObject({ registrados: 1, compradores: 0 });
    // Nunca ve correos ni documentos de sus referidos.
    expect(JSON.stringify(conReferido.body)).not.toContain(bruno.correo);
  });

  it('un admin habilita a alguien sin licencia; si la licencia vence, el código deja de atribuir', async () => {
    const elena = await clienteConSesion(app, { nombre: 'Elena Díaz' });
    expect((await elena.web.get('/referidos/mio').expect(200)).body.puedeReferir).toBe(false);

    await elena.web
      .put(`/admin/referidos/clientes/${elena.usuario.id}/habilitado`, { habilitado: true })
      .expect(403);
    const sinCodigo = await admin.web
      .put(`/admin/referidos/clientes/${elena.usuario.id}/habilitado`, { habilitado: true })
      .expect(403);
    expect(sinCodigo.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await admin.confirmar();
    await admin.web
      .put(`/admin/referidos/clientes/${elena.usuario.id}/habilitado`, { habilitado: true })
      .expect(200);
    const vista = await elena.web.get('/referidos/mio').expect(200);
    expect(vista.body).toMatchObject({ puedeReferir: true, via: 'HABILITADO' });
    const ficha = await admin.web.get(`/admin/referidos/clientes/${elena.usuario.id}`).expect(200);
    expect(ficha.body.perfil).toMatchObject({ habilitado: true, codigo: vista.body.perfil.codigo });

    const fabio = await clienteConSesion(app, { codigoReferido: vista.body.perfil.codigo });
    expect(await referidoPor(fabio.usuario.id)).toBe(elena.usuario.id);

    // Sin la habilitación (y sin licencia), su código ya no atribuye a nadie.
    await admin.web
      .put(`/admin/referidos/clientes/${elena.usuario.id}/habilitado`, { habilitado: false })
      .expect(200);
    await comoLaWeb(app).get(`/referidos/codigo/${vista.body.perfil.codigo}`).expect(404);
    const gina = await clienteConSesion(app, { codigoReferido: vista.body.perfil.codigo });
    expect(await referidoPor(gina.usuario.id)).toBeNull();

    const acciones = (await fuente.query(
      `SELECT action FROM audit_log WHERE target_id = $1 AND action LIKE 'referido.%' ORDER BY id`,
      [elena.usuario.id],
    )) as { action: string }[];
    expect(acciones.map((a) => a.action)).toEqual([
      'referido.habilitado',
      'referido.deshabilitado',
    ]);
  });

  it('cada compra del referido deja el 20 % al referidor, salvo mientras su licencia está vencida', async () => {
    const hugo = await clienteConSesion(app, { nombre: 'Hugo Ramírez', codigoReferido: codigoAna });
    const primera = await comprar(hugo, admin);
    expect(await comision(primera)).toMatchObject({
      referrer_id: ana.usuario.id,
      referral_bp: 2000,
      referral_usd_cents: 2400,
      referral_payout_id: null,
    });
    expect(await correo(ana.usuario.id, 'referido-comision')).toMatchObject({
      referido: 'Hugo R.',
      comision: 'USD 24',
      porcentaje: '20\u00a0%',
      monto: 'USD 120',
      direccion: 'no',
      ruta: '/panel/referidos',
    });

    await fuente.query(`UPDATE licenses SET status = 'VENCIDA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);
    const segunda = await comprar(hugo, admin);
    expect(await comision(segunda)).toMatchObject({ referrer_id: null, referral_usd_cents: null });
    await fuente.query(`UPDATE licenses SET status = 'ACTIVA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);

    const vista = await ana.web.get('/referidos/mio').expect(200);
    expect(vista.body.cifras).toMatchObject({ compradores: 1, acumuladoUsdCents: 2400 });
    expect(vista.body.comisiones).toEqual([
      expect.objectContaining({ referido: 'Hugo R.', comisionUsdCents: 2400, estado: 'ACUMULADA' }),
    ]);
  });

  it('liquida por quincena con dirección, mínimo y espera de 48 h tras cambiarla; el admin marca el envío', async () => {
    const referidos = app.get(ReferidosService);
    const ivan = await clienteConSesion(app, { nombre: 'Iván Castro', codigoReferido: codigoAna });
    const venta = await comprar(ivan, admin);
    await fuente.query(
      `UPDATE payment_orders SET decided_at = '2025-03-05T10:00:00-05:00'
        WHERE referrer_id = $1 AND referral_payout_id IS NULL`,
      [ana.usuario.id],
    );

    // Sin dirección de cobro, se acumula.
    await referidos.liquidar();
    expect(await pagosDe(ana.usuario.id)).toEqual([]);

    // Registrar la dirección pide confirmar la identidad y una dirección de Tron con su suma de control.
    const sinConfirmar = await ana.web
      .put('/referidos/mio/direccion', { direccion: DIRECCION_1 })
      .expect(403);
    expect(sinConfirmar.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await ana.confirmar();
    const mala = await ana.web
      .put('/referidos/mio/direccion', { direccion: `${DIRECCION_1.slice(0, -1)}y` })
      .expect(400);
    expect(mala.body.campos.direccion).toBeTruthy();
    await ana.web.put('/referidos/mio/direccion', { direccion: DIRECCION_1 }).expect(200);
    expect(await correo(ana.usuario.id, 'referido-direccion-cambiada')).toMatchObject({
      direccion: DIRECCION_1,
      horas: '0',
    });

    // La primera dirección no espera: se cierra el pago con las dos ventas (Hugo e Iván).
    expect(await referidos.liquidar()).toBeGreaterThanOrEqual(1);
    const [pago] = await pagosDe(ana.usuario.id);
    expect(pago).toMatchObject({
      inicio: '2025-03-01',
      sales_count: 2,
      comision: 4800,
      usdt_address: DIRECCION_1,
      status: 'CERRADA',
    });
    expect((await comision(venta)).referral_payout_id).toBe(pago!.id);
    expect(await correo(admin.usuario.id, 'referidos-por-pagar')).toBeTruthy();
    await referidos.liquidar();
    expect(await pagosDe(ana.usuario.id)).toHaveLength(1);

    // Cambia la dirección: lo que se cierre en las 48 horas siguientes espera.
    await ana.web.put('/referidos/mio/direccion', { direccion: DIRECCION_2 }).expect(200);
    expect(await correo(ana.usuario.id, 'referido-direccion-cambiada')).toMatchObject({
      horas: '48',
    });
    const otra = await comprar(ivan, admin);
    await alPasado(otra, '2025-04-02T10:00:00-05:00');
    await referidos.liquidar();
    expect(await pagosDe(ana.usuario.id)).toHaveLength(1);
    expect(
      (await ana.web.get('/referidos/mio').expect(200)).body.perfil.enEsperaHasta,
    ).toBeTruthy();
    await fuente.query(
      `UPDATE referral_profiles SET address_changed_at = now() - interval '49 hours' WHERE user_id = $1`,
      [ana.usuario.id],
    );

    // Con un mínimo de USD 30, los USD 24 se acumulan; con USD 20, se pagan.
    await admin.confirmar();
    await admin.web
      .put('/admin/referidos/ajustes', {
        porcentajeBp: 2000,
        minimoPagoUsdCents: 3000,
        activo: true,
      })
      .expect(200);
    await referidos.liquidar();
    expect(await pagosDe(ana.usuario.id)).toHaveLength(1);
    await admin.web
      .put('/admin/referidos/ajustes', {
        porcentajeBp: 2000,
        minimoPagoUsdCents: 2000,
        activo: true,
      })
      .expect(200);
    await referidos.liquidar();
    const pagos = await pagosDe(ana.usuario.id);
    expect(pagos[1]).toMatchObject({
      inicio: '2025-04-01',
      comision: 2400,
      usdt_address: DIRECCION_2,
    });

    // El admin marca enviado el primero con el hash: pide el código y no se marca dos veces.
    const vistaAdmin = await admin.web.get('/admin/referidos').expect(200);
    expect(vistaAdmin.body.porEnviar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pago!.id, comisionUsdCents: 4800, direccion: DIRECCION_1 }),
      ]),
    );
    await admin.web
      .post(`/admin/referidos/pagos/${pago!.id}/enviado`, { hash: 'no es un hash' })
      .expect(400);
    const hash = 'a'.repeat(64);
    await admin.web.post(`/admin/referidos/pagos/${pago!.id}/enviado`, { hash }).expect(200);
    await admin.web.post(`/admin/referidos/pagos/${pago!.id}/enviado`, { hash }).expect(409);
    expect((await pagosDe(ana.usuario.id))[0]).toMatchObject({ status: 'PAGADA', tx_hash: hash });
    expect(await correo(ana.usuario.id, 'referido-pago-enviado')).toMatchObject({
      monto: 'USD 48',
      direccion: DIRECCION_1,
      hash,
      periodo: '1 de marzo al 15 de marzo de 2025',
    });
    const mia = await ana.web.get('/referidos/mio').expect(200);
    expect(mia.body.cifras).toMatchObject({ pagadoUsdCents: 4800, porPagarUsdCents: 2400 });
  });

  it('el admin anula una comisión sin liquidar y corrige el referidor', async () => {
    const julia = await clienteConSesion(app, { codigoReferido: codigoAna });
    const venta = await comprar(julia, admin);
    expect((await comision(venta)).referral_usd_cents).toBe(2400);
    await admin.confirmar();
    await admin.web
      .post(`/admin/referidos/ordenes/${venta}/anular`, { motivo: 'Autorreferido' })
      .expect(200);
    expect(await comision(venta)).toMatchObject({ referrer_id: null, referral_usd_cents: null });
    await admin.web
      .post(`/admin/referidos/ordenes/${venta}/anular`, { motivo: 'Otra vez' })
      .expect(404);

    await admin.web
      .put(`/admin/referidos/clientes/${julia.usuario.id}/referidor`, {
        motivo: 'Se registró por error',
      })
      .expect(200);
    expect(await referidoPor(julia.usuario.id)).toBeNull();
    await admin.web
      .put(`/admin/referidos/clientes/${julia.usuario.id}/referidor`, {
        codigo: 'ZZZZ2222',
        motivo: 'Prueba',
      })
      .expect(400);
    await admin.web
      .put(`/admin/referidos/clientes/${julia.usuario.id}/referidor`, {
        codigo: codigoAna,
        motivo: 'Lo invitó Ana',
      })
      .expect(200);
    expect(await referidoPor(julia.usuario.id)).toBe(ana.usuario.id);
  });

  it('el socio refiere con su cuenta de admin; otro admin no', async () => {
    const socio = await adminConSesion(app);
    const [antes] = (await fuente.query(
      `SELECT user_id FROM partner_profiles ORDER BY created_at LIMIT 1`,
    )) as { user_id: string }[];
    try {
      await fuente.query(
        `UPDATE partner_profiles SET user_id = $1 WHERE id = (SELECT id FROM partner_profiles ORDER BY created_at LIMIT 1)`,
        [socio.usuario.id],
      );
      const vista = await socio.web.get('/referidos/mio').expect(200);
      expect(vista.body).toMatchObject({ puedeReferir: true, via: 'SOCIO' });
      const karen = await clienteConSesion(app, { codigoReferido: vista.body.perfil.codigo });
      expect(await referidoPor(karen.usuario.id)).toBe(socio.usuario.id);
      await comprar(karen, admin);
      expect(await correo(socio.usuario.id, 'referido-comision')).toMatchObject({
        ruta: '/admin/socio',
      });
      expect((await admin.web.get('/referidos/mio').expect(200)).body.puedeReferir).toBe(false);
    } finally {
      await fuente.query(
        `UPDATE partner_profiles SET user_id = $1 WHERE id = (SELECT id FROM partner_profiles ORDER BY created_at LIMIT 1)`,
        [antes!.user_id],
      );
    }
  });

  it('"mis datos" incluye los referidos, y al eliminar al referidor se borran su código y su dirección', async () => {
    const descarga = await ana.web.get('/privacidad/mis-datos').expect(200);
    expect(descarga.body.referidos).toMatchObject({
      codigo: codigoAna,
      direccionDeCobro: DIRECCION_2,
    });
    expect(
      descarga.body.referidos.personasInvitadas.map((p: { nombre: string }) => p.nombre),
    ).toContain('Hugo R.');

    await admin.confirmar();
    await admin.web
      .post(`/admin/clientes/${ana.usuario.id}/eliminar`, { motivo: 'Lo pidió por soporte.' })
      .expect(200);
    const perfiles = (await fuente.query(`SELECT 1 FROM referral_profiles WHERE user_id = $1`, [
      ana.usuario.id,
    ])) as unknown[];
    expect(perfiles).toHaveLength(0);
    await comoLaWeb(app).get(`/referidos/codigo/${codigoAna}`).expect(404);
  });
});
