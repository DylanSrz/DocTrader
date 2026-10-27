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
  await fuente.query(
    `UPDATE settings SET value = '2000'::jsonb WHERE key = 'referrals.min_payout_usd_cents'`,
  );
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

/** Las comisiones de referidos de una orden, de la primera línea a la segunda. */
async function comisiones(numero: string) {
  return (await fuente.query(
    `SELECT c.referrer_id, c.level, c.bp, c.usd_cents, c.payout_id
       FROM referral_commissions c JOIN payment_orders o ON o.id = c.payment_order_id
      WHERE o.number = $1 ORDER BY c.level`,
    [numero],
  )) as {
    referrer_id: string;
    level: number;
    bp: number;
    usd_cents: number;
    payout_id: string | null;
  }[];
}

/** Corre la venta a una quincena ya terminada, para que la liquidación la tome. */
async function alPasado(numero: string, fecha = '2025-03-05T10:00:00-05:00') {
  await fuente.query(`UPDATE payment_orders SET decided_at = $2 WHERE number = $1`, [
    numero,
    fecha,
  ]);
  await fuente.query(
    `UPDATE referral_commissions SET earned_at = $2
      WHERE payment_order_id = (SELECT id FROM payment_orders WHERE number = $1)`,
    [numero, fecha],
  );
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
    expect(antes.body.programa).toMatchObject({
      activo: true,
      porcentajeBp: 1500,
      segundaLineaBp: 500,
    });

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

  it('un admin habilita por correo a quien se registró sin cuenta de trading', async () => {
    const correo = `Irene.${Date.now()}@Correo.co`;
    const irene = await clienteConSesion(app, {
      nombre: 'Irene Castro',
      correo: correo.toLowerCase(),
    });
    // Un admin propio: el compartido ya gastó sus confirmaciones de los 15 minutos.
    const otroAdmin = await adminConSesion(app);
    await otroAdmin.confirmar();
    const noExiste = await otroAdmin.web
      .put('/admin/referidos/habilitado', { correo: 'nadie@correo.co', habilitado: true })
      .expect(400);
    expect(noExiste.body.campos.correo).toMatch(/No hay ningún cliente/);
    // Tampoco sirve para un admin.
    await otroAdmin.web
      .put('/admin/referidos/habilitado', { correo: otroAdmin.usuario.email, habilitado: true })
      .expect(400);

    const r = await otroAdmin.web
      .put('/admin/referidos/habilitado', { correo: ` ${correo} `.trim(), habilitado: true })
      .expect(200);
    expect(r.body.nombre).toBe('Irene Castro');
    expect((await irene.web.get('/referidos/mio').expect(200)).body).toMatchObject({
      puedeReferir: true,
      via: 'HABILITADO',
    });
    await otroAdmin.web
      .put('/admin/referidos/habilitado', { correo, habilitado: false })
      .expect(200);
    expect((await irene.web.get('/referidos/mio').expect(200)).body.puedeReferir).toBe(false);
  });

  it('cada compra del referido deja el 15 % al referidor, salvo mientras su licencia está vencida', async () => {
    const hugo = await clienteConSesion(app, { nombre: 'Hugo Ramírez', codigoReferido: codigoAna });
    const primera = await comprar(hugo, admin);
    expect(await comisiones(primera)).toEqual([
      { referrer_id: ana.usuario.id, level: 1, bp: 1500, usd_cents: 1800, payout_id: null },
    ]);
    expect(await correo(ana.usuario.id, 'referido-comision')).toMatchObject({
      referido: 'Hugo R.',
      comision: 'USD 18',
      porcentaje: '15\u00a0%',
      via: '',
      monto: 'USD 120',
      direccion: 'no',
      ruta: '/panel/referidos',
    });

    await fuente.query(`UPDATE licenses SET status = 'VENCIDA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);
    const segunda = await comprar(hugo, admin);
    expect(await comisiones(segunda)).toEqual([]);
    await fuente.query(`UPDATE licenses SET status = 'ACTIVA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);

    const vista = await ana.web.get('/referidos/mio').expect(200);
    expect(vista.body.cifras).toMatchObject({ compradores: 1, acumuladoUsdCents: 1800 });
    expect(vista.body.comisiones).toEqual([
      expect.objectContaining({
        referido: 'Hugo R.',
        nivel: 1,
        comisionUsdCents: 1800,
        estado: 'ACUMULADA',
      }),
    ]);
  });

  it('liquida por quincena con dirección, mínimo y espera de 48 h tras cambiarla; el admin marca el envío', async () => {
    const referidos = app.get(ReferidosService);
    const ivan = await clienteConSesion(app, { nombre: 'Iván Castro', codigoReferido: codigoAna });
    const venta = await comprar(ivan, admin);
    await fuente.query(
      `UPDATE referral_commissions SET earned_at = '2025-03-05T10:00:00-05:00'
        WHERE referrer_id = $1 AND payout_id IS NULL`,
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
      comision: 3600,
      usdt_address: DIRECCION_1,
      status: 'CERRADA',
    });
    expect((await comisiones(venta))[0]!.payout_id).toBe(pago!.id);
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

    // Con un mínimo de USD 30, los USD 18 se acumulan; con USD 15, se pagan.
    await admin.confirmar();
    await admin.web
      .put('/admin/referidos/ajustes', {
        porcentajeBp: 1500,
        segundaLineaBp: 500,
        minimoPagoUsdCents: 3000,
        activo: true,
      })
      .expect(200);
    await referidos.liquidar();
    expect(await pagosDe(ana.usuario.id)).toHaveLength(1);
    await admin.web
      .put('/admin/referidos/ajustes', {
        porcentajeBp: 1500,
        segundaLineaBp: 500,
        minimoPagoUsdCents: 1500,
        activo: true,
      })
      .expect(200);
    await referidos.liquidar();
    const pagos = await pagosDe(ana.usuario.id);
    expect(pagos[1]).toMatchObject({
      inicio: '2025-04-01',
      comision: 1800,
      usdt_address: DIRECCION_2,
    });

    // El admin marca enviado el primero con el hash: pide el código y no se marca dos veces.
    const vistaAdmin = await admin.web.get('/admin/referidos').expect(200);
    expect(vistaAdmin.body.porEnviar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pago!.id, comisionUsdCents: 3600, direccion: DIRECCION_1 }),
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
      monto: 'USD 36',
      direccion: DIRECCION_1,
      hash,
      periodo: '1 de marzo al 15 de marzo de 2025',
    });
    const mia = await ana.web.get('/referidos/mio').expect(200);
    expect(mia.body.cifras).toMatchObject({ pagadoUsdCents: 3600, porPagarUsdCents: 1800 });
  });

  it('el admin anula una comisión sin liquidar y corrige el referidor', async () => {
    const julia = await clienteConSesion(app, { codigoReferido: codigoAna });
    const venta = await comprar(julia, admin);
    expect((await comisiones(venta)).map((c) => c.usd_cents)).toEqual([1800]);
    await admin.confirmar();
    await admin.web
      .post(`/admin/referidos/ordenes/${venta}/anular`, { motivo: 'Autorreferido' })
      .expect(200);
    expect(await comisiones(venta)).toEqual([]);
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

  it('la segunda línea deja el 5 % a quien invitó al referidor, aunque el intermedio esté vencido', async () => {
    // Ana → Luis → Marta. Luis tiene licencia; Marta compra.
    const luis = await clienteConSesion(app, { nombre: 'Luis Prado', codigoReferido: codigoAna });
    await comprar(luis, admin);
    const codigoLuis = (await luis.web.get('/referidos/mio').expect(200)).body.perfil
      .codigo as string;
    const marta = await clienteConSesion(app, { nombre: 'Marta Gil', codigoReferido: codigoLuis });

    const primera = await comprar(marta, admin);
    expect(await comisiones(primera)).toEqual([
      { referrer_id: luis.usuario.id, level: 1, bp: 1500, usd_cents: 1800, payout_id: null },
      { referrer_id: ana.usuario.id, level: 2, bp: 500, usd_cents: 600, payout_id: null },
    ]);
    expect(await correo(ana.usuario.id, 'referido-comision')).toMatchObject({
      referido: 'Marta G.',
      via: 'Luis P.',
      comision: 'USD 6',
      porcentaje: '5\u00a0%',
    });

    // Luis vencido: él no cobra, pero Ana sí cobra su 5 %.
    await fuente.query(`UPDATE licenses SET status = 'VENCIDA' WHERE user_id = $1`, [
      luis.usuario.id,
    ]);
    const segunda = await comprar(marta, admin);
    expect((await comisiones(segunda)).map((c) => [c.level, c.referrer_id])).toEqual([
      [2, ana.usuario.id],
    ]);
    await fuente.query(`UPDATE licenses SET status = 'ACTIVA' WHERE user_id = $1`, [
      luis.usuario.id,
    ]);

    // Ana vencida: no hay 5 %.
    await fuente.query(`UPDATE licenses SET status = 'VENCIDA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);
    const tercera = await comprar(marta, admin);
    expect((await comisiones(tercera)).map((c) => c.level)).toEqual([1]);
    await fuente.query(`UPDATE licenses SET status = 'ACTIVA' WHERE user_id = $1`, [
      ana.usuario.id,
    ]);

    // Ana ve su red en dos líneas; Marta aparece "vía Luis P.".
    const vista = await ana.web.get('/referidos/mio').expect(200);
    expect(vista.body.referidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nombre: 'Luis P.', nivel: 1, via: null }),
        expect.objectContaining({ nombre: 'Marta G.', nivel: 2, via: 'Luis P.' }),
      ]),
    );
    expect(vista.body.cifras).toMatchObject({ registradosSegunda: 1, compradoresSegunda: 1 });
    expect(vista.body.comisiones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          referido: 'Marta G.',
          nivel: 2,
          via: 'Luis P.',
          comisionUsdCents: 600,
        }),
      ]),
    );
    // Luis no ve la línea de arriba: solo a Marta, en su primera línea.
    const deLuis = await luis.web.get('/referidos/mio').expect(200);
    expect(deLuis.body.referidos.map((r: { nombre: string }) => r.nombre)).toEqual(['Marta G.']);

    // Anular solo la segunda línea de la primera compra.
    await admin.confirmar();
    await admin.web
      .post(`/admin/referidos/ordenes/${primera}/anular`, {
        nivel: 2,
        motivo: 'Prueba de anulación',
      })
      .expect(200);
    expect((await comisiones(primera)).map((c) => c.level)).toEqual([1]);

    // Corregir el referidor de Ana a Marta formaría un ciclo (Ana → Luis → Marta → Ana).
    const codigoMarta = (await marta.web.get('/referidos/mio').expect(200)).body.perfil?.codigo as
      string | undefined;
    const codigoParaCiclo =
      codigoMarta ?? (await luis.web.get('/referidos/mio').expect(200)).body.perfil.codigo;
    const ciclo = await admin.web
      .put(`/admin/referidos/clientes/${ana.usuario.id}/referidor`, {
        codigo: codigoParaCiclo,
        motivo: 'Prueba de ciclo',
      })
      .expect(400);
    expect(ciclo.body.campos.codigo).toMatch(/ciclo/);
  });

  it('el socio y cualquier otro admin refieren con su cuenta de admin', async () => {
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
        ruta: '/admin/referidos',
      });

      // El otro admin no es el socio, pero también refiere: su enlace, su red y su cobro.
      const otro = await admin.web.get('/referidos/mio').expect(200);
      expect(otro.body).toMatchObject({ puedeReferir: true, via: 'ADMIN' });
      expect(otro.body.perfil.codigo).not.toBe(vista.body.perfil.codigo);
      const lucia = await clienteConSesion(app, { codigoReferido: otro.body.perfil.codigo });
      expect(await referidoPor(lucia.usuario.id)).toBe(admin.usuario.id);
      const ordenLucia = await comprar(lucia, admin);
      expect((await comisiones(ordenLucia)).map((c) => [c.referrer_id, c.level])).toEqual([
        [admin.usuario.id, 1],
      ]);

      // Su segunda línea: quien llega con el código de Lucía le deja el 5 % al admin.
      const codigoLucia = (await lucia.web.get('/referidos/mio').expect(200)).body.perfil.codigo;
      const pedro = await clienteConSesion(app, { codigoReferido: codigoLucia });
      const ordenPedro = await comprar(pedro, admin);
      expect((await comisiones(ordenPedro)).map((c) => [c.referrer_id, c.level])).toEqual([
        [lucia.usuario.id, 1],
        [admin.usuario.id, 2],
      ]);
      const red = await admin.web.get('/referidos/mio').expect(200);
      expect(red.body.referidos.map((r: { nivel: number }) => r.nivel).sort()).toEqual([1, 2]);
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
