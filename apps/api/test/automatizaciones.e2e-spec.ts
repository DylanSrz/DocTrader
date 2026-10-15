import { aUnidadesBase } from '@doctrader/shared';
import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { AvisosService } from '../src/avisos/avisos.service.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { VencimientoLicencias } from '../src/licencias/vencimiento-licencias.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import type { Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { Alertas, claveIngresosFallidos } from '../src/monitoreo/alertas.js';
import { BorradoDatos } from '../src/privacidad/borrado-datos.js';
import { REDIS } from '../src/redis/redis.module.js';
import { SocioService } from '../src/socio/socio.service.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';
import { comoLaWeb, crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
let licencias: VencimientoLicencias;

const blockchain = new Map<string, Lectura>();

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
  licencias = new VencimientoLicencias(fuente, app.get(AvisosService));
});

afterAll(async () => {
  await app.close();
});

type Cliente = Awaited<ReturnType<typeof clienteConSesion>>;

/** El cliente pide una orden mensual en USDT, la paga exacta y la blockchain la da por buena. */
async function pagar(cliente: Cliente, cuentaId: string) {
  const orden = await cliente.web
    .post('/ordenes', { cuentaId, plan: 'MENSUAL', moneda: 'USDT' })
    .expect(201);
  const hash = hashNuevo();
  blockchain.set(hash, {
    encontrada: true,
    exitosa: true,
    hora: new Date(),
    bloque: 100,
    confirmaciones: 25,
    pagos: [
      {
        direccion: orden.body.direccion,
        unidades: aUnidadesBase(orden.body.monto, 'USDT'),
      },
    ],
    otraMoneda: false,
    remitentes: [],
  });
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await app.get(VerificacionPagos).verificarPendientes();
  return orden.body.numero as string;
}

/** Cuántos correos de cada plantilla tiene un destinatario (por correo o por id de usuario). */
async function correos(filtro: { correo?: string; usuarioId?: string }) {
  const filas = (await fuente.query(
    `SELECT template, count(*)::int AS n FROM notifications
      WHERE ($1::text IS NULL OR recipient = $1) AND ($2::uuid IS NULL OR user_id = $2)
      GROUP BY template`,
    [filtro.correo ?? null, filtro.usuarioId ?? null],
  )) as { template: string; n: number }[];
  return Object.fromEntries(filas.map((f) => [f.template, f.n]));
}

/** Mueve el vencimiento de la licencia de una cuenta (con su inicio, para respetar las fechas). */
async function vencimiento(cuentaId: string, fin: string, gracia: string) {
  await fuente.query(
    `UPDATE licenses SET ends_at = now() + $2::interval, grace_ends_at = now() + $3::interval,
            starts_at = now() + $2::interval - interval '30 days'
      WHERE trading_account_id = $1`,
    [cuentaId, fin, gracia],
  );
}

describe('automatizaciones', () => {
  it('una licencia mensual recorre su ciclo y cada correo llega una sola vez', async () => {
    const admin = await adminConSesion(app);
    const cliente = await clienteConSesion(app);
    expect((await correos({ correo: cliente.correo })).bienvenida).toBe(1);

    // Compra: verificada → aviso a los admins; aprobada → correo al cliente y venta a los admins.
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const cuentaId = cuenta.body.id as string;
    const primera = await pagar(cliente, cuentaId);
    await admin.web.post(`/admin/pagos/${primera}/aprobar`, {}).expect(200);
    await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`, {}).expect(200);

    // Recordatorios: el de cada tramo, una vez, aunque el trabajo corra varias veces.
    for (const [fin, gracia] of [
      ['6 days 12 hours', '9 days 12 hours'],
      ['2 days 12 hours', '5 days 12 hours'],
      ['20 hours', '3 days 20 hours'],
    ]) {
      await vencimiento(cuentaId, fin!, gracia!);
      await licencias.recordar();
      await licencias.recordar();
    }

    // Vence: entra en gracia (sigue conectada) y el cliente renueva durante la gracia.
    await vencimiento(cuentaId, '-1 minute', '3 days');
    await licencias.actualizar();
    await licencias.actualizar();
    const renovacion = await pagar(cliente, cuentaId);
    await admin.web.post(`/admin/pagos/${renovacion}/aprobar`, {}).expect(200);
    const [renovada] = (await fuente.query(
      `SELECT l.status, t.connection_status FROM licenses l
         JOIN trading_accounts t ON t.id = l.trading_account_id WHERE t.id = $1`,
      [cuentaId],
    )) as { status: string; connection_status: string }[];
    expect(renovada).toEqual({ status: 'ACTIVA', connection_status: 'CONECTADA' });

    // El periodo nuevo trae su propio recordatorio; esta vez no renueva y la cuenta queda por desconectar.
    await vencimiento(cuentaId, '6 days', '9 days');
    await licencias.recordar();
    await vencimiento(cuentaId, '-1 minute', '3 days');
    await licencias.actualizar();
    await vencimiento(cuentaId, '-4 days', '-1 minute');
    await licencias.actualizar();
    await licencias.actualizar();
    await licencias.recordar();

    const [final] = (await fuente.query(
      `SELECT l.status, t.connection_status FROM licenses l
         JOIN trading_accounts t ON t.id = l.trading_account_id WHERE t.id = $1`,
      [cuentaId],
    )) as { status: string; connection_status: string }[];
    expect(final).toEqual({ status: 'VENCIDA', connection_status: 'POR_DESCONECTAR' });

    expect(await correos({ correo: cliente.correo })).toEqual({
      'verificar-correo': 1,
      bienvenida: 1,
      'pago-aprobado': 2,
      'cuenta-conectada': 1,
      'licencia-por-vencer': 4,
      'licencia-en-gracia': 2,
      'licencia-vencida': 1,
    });
    const recordatorios = (await fuente.query(
      `SELECT payload->>'dias' AS dias FROM notifications
        WHERE recipient = $1 AND template = 'licencia-por-vencer' ORDER BY created_at`,
      [cliente.correo],
    )) as { dias: string }[];
    expect(recordatorios.map((r) => r.dias)).toEqual(['7', '3', '1', '7']);

    expect(await correos({ usuarioId: admin.usuario.id })).toEqual({
      'pago-por-revisar': 2,
      'venta-aprobada': 2,
      'cuenta-por-desconectar': 1,
    });
    const [venta] = (await fuente.query(
      `SELECT payload FROM notifications WHERE user_id = $1 AND template = 'venta-aprobada'
        ORDER BY created_at LIMIT 1`,
      [admin.usuario.id],
    )) as { payload: Record<string, string> }[];
    expect(venta!.payload).toMatchObject({
      quien: 'Admin aprobó',
      plan: 'mensual',
      monto: 'USD 120',
      conectar: 'si',
    });
  });

  it('no le recuerda la renovación a quien ya reportó el pago', async () => {
    const cliente = await clienteConSesion(app);
    const admin = await adminConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const cuentaId = cuenta.body.id as string;
    await admin.web.post(`/admin/pagos/${await pagar(cliente, cuentaId)}/aprobar`, {}).expect(200);
    await vencimiento(cuentaId, '2 days', '5 days');
    await pagar(cliente, cuentaId);
    await licencias.recordar();
    expect((await correos({ correo: cliente.correo }))['licencia-por-vencer']).toBeUndefined();
  });

  it('cuando el cliente cambia los datos de una cuenta conectada, los admins la ven por conectar', async () => {
    const cliente = await clienteConSesion(app);
    const admin = await adminConSesion(app);
    const datos = datosCuenta();
    const cuenta = await cliente.web.post('/cuentas', datos).expect(201);
    const cuentaId = cuenta.body.id as string;
    await admin.web.post(`/admin/pagos/${await pagar(cliente, cuentaId)}/aprobar`, {}).expect(200);
    await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`, {}).expect(200);
    await cliente.web
      .put(`/cuentas/${cuentaId}`, {
        titular: datos.titular,
        broker: datos.broker,
        servidor: datos.servidor,
        numero: datos.numero,
        contrasenaOperativa: 'otra-operativa-1',
      })
      .expect(200);
    const [aviso] = (await fuente.query(
      `SELECT payload FROM notifications WHERE user_id = $1 AND template = 'cuenta-por-conectar'`,
      [admin.usuario.id],
    )) as { payload: Record<string, string> }[];
    expect(aviso?.payload).toMatchObject({
      cliente: 'Laura Gómez Restrepo',
      campos: 'contraseña operativa',
    });
  });
});

describe('socio', () => {
  let socioAntes: { user_id: string; commission_bp: number };

  beforeAll(async () => {
    [socioAntes] = (await fuente.query(
      `SELECT user_id, commission_bp FROM partner_profiles ORDER BY created_at LIMIT 1`,
    )) as (typeof socioAntes)[];
  });

  afterAll(async () => {
    await fuente.query(
      `UPDATE partner_profiles SET user_id = $1, commission_bp = $2
        WHERE id = (SELECT id FROM partner_profiles ORDER BY created_at LIMIT 1)`,
      [socioAntes.user_id, socioAntes.commission_bp],
    );
  });

  it('solo el socio cambia su porcentaje, con el segundo factor, y aplica a las ventas siguientes', async () => {
    const otro = await adminConSesion(app);
    const socio = await adminConSesion(app);
    await fuente.query(
      `UPDATE partner_profiles SET user_id = $1
        WHERE id = (SELECT id FROM partner_profiles ORDER BY created_at LIMIT 1)`,
      [socio.usuario.id],
    );

    const vista = await socio.web.get('/admin/socio').expect(200);
    expect(vista.body.socio).toMatchObject({
      porcentajeBp: socioAntes.commission_bp,
      esElSocio: true,
    });
    expect((await otro.web.get('/admin/socio').expect(200)).body.socio.esElSocio).toBe(false);

    await otro.confirmar();
    const ajeno = await otro.web.put('/admin/socio/comision', { porcentajeBp: 4000 }).expect(403);
    expect(ajeno.body.codigo).toBe('SOLO_EL_SOCIO');
    const sinCodigo = await socio.web
      .put('/admin/socio/comision', { porcentajeBp: 1250 })
      .expect(403);
    expect(sinCodigo.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await socio.confirmar();
    await socio.web.put('/admin/socio/comision', { porcentajeBp: 9000 }).expect(400);
    await socio.web.put('/admin/socio/comision', { porcentajeBp: 1250 }).expect(200);

    const despues = await socio.web.get('/admin/socio').expect(200);
    expect(despues.body.socio.porcentajeBp).toBe(1250);
    expect(despues.body.cambios[0]).toMatchObject({
      anteriorBp: socioAntes.commission_bp,
      nuevoBp: 1250,
    });
    const [aviso] = (await fuente.query(
      `SELECT payload FROM notifications WHERE user_id = $1 AND template = 'comision-cambiada'`,
      [otro.usuario.id],
    )) as { payload: Record<string, string> }[];
    expect(aviso?.payload).toMatchObject({ nuevo: '12,5 %' });

    // La venta siguiente se aprueba con el porcentaje nuevo.
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const numero = await pagar(cliente, cuenta.body.id as string);
    await otro.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(200);
    const [orden] = (await fuente.query(
      `SELECT commission_bp, commission_usd_cents FROM payment_orders WHERE number = $1`,
      [numero],
    )) as { commission_bp: number; commission_usd_cents: number }[];
    expect(orden).toEqual({ commission_bp: 1250, commission_usd_cents: 1500 });
  });

  it('liquida cada quincena terminada una sola vez y se marca como pagada', async () => {
    const admin = await adminConSesion(app);
    const cliente = await clienteConSesion(app);
    const ordenes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
      const numero = await pagar(cliente, cuenta.body.id as string);
      await admin.web.post(`/admin/pagos/${numero}/aprobar`, {}).expect(200);
      ordenes.push(numero);
    }
    // Dos ventas el 15 de enero de 2025 a las 11 p. m. de Colombia y otra el 20: dos quincenas distintas.
    const fechas = [
      '2025-01-03T10:00:00-05:00',
      '2025-01-15T23:00:00-05:00',
      '2025-01-20T10:00:00-05:00',
    ];
    for (const [i, numero] of ordenes.entries()) {
      await fuente.query(
        `UPDATE payment_orders SET decided_at = $2, commission_bp = 1000, commission_usd_cents = 1200
          WHERE number = $1`,
        [numero, fechas[i]],
      );
    }

    const socio = app.get(SocioService);
    expect(await socio.liquidar()).toBe(2);
    expect(await socio.liquidar()).toBe(0);
    const liquidaciones = (await fuente.query(
      `SELECT id, to_char(period_start, 'YYYY-MM-DD') AS inicio, to_char(period_end, 'YYYY-MM-DD') AS fin,
              sales_count, gross_usd_cents::int AS bruto, commission_usd_cents::int AS comision, status
         FROM commission_payouts WHERE period_start < '2025-02-01' ORDER BY period_start`,
    )) as {
      id: string;
      inicio: string;
      fin: string;
      sales_count: number;
      bruto: number;
      comision: number;
    }[];
    expect(liquidaciones.map(({ id: _id, ...l }) => l)).toEqual([
      {
        inicio: '2025-01-01',
        fin: '2025-01-15',
        sales_count: 2,
        bruto: 24000,
        comision: 2400,
        status: 'CERRADA',
      },
      {
        inicio: '2025-01-16',
        fin: '2025-01-31',
        sales_count: 1,
        bruto: 12000,
        comision: 1200,
        status: 'CERRADA',
      },
    ]);
    const [aviso] = (await fuente.query(
      `SELECT payload FROM notifications WHERE user_id = $1 AND template = 'comision-liquidada'
        ORDER BY payload->>'periodo'`,
      [admin.usuario.id],
    )) as { payload: Record<string, string> }[];
    expect(aviso?.payload).toMatchObject({
      periodo: '1 al 15 de enero de 2025',
      bruto: 'USD 240',
      comision: 'USD 24',
      ventas: '2 ventas',
    });

    const primera = liquidaciones[0]!.id;
    await admin.confirmar();
    await admin.web
      .post(`/admin/socio/liquidaciones/${primera}/pagada`, { referencia: 'TX 9f2c' })
      .expect(200);
    await admin.web.post(`/admin/socio/liquidaciones/${primera}/pagada`, {}).expect(409);
    const vista = await admin.web.get('/admin/socio').expect(200);
    const pagada = vista.body.liquidaciones.find((l: { id: string }) => l.id === primera);
    expect(pagada).toMatchObject({
      estado: 'PAGADA',
      referencia: 'TX 9f2c',
      pagadaPor: 'Admin de pruebas',
    });
  });
});

describe('borrado de datos vencidos', () => {
  it('borra las contraseñas, los tickets y los registros que pasaron su plazo, y nada más', async () => {
    const cliente = await clienteConSesion(app);
    const vieja = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const reciente = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    await fuente.query(
      `UPDATE trading_accounts SET connection_status = 'DESCONECTADA', disconnected_at = now() - interval '91 days'
        WHERE id = $1`,
      [vieja.body.id],
    );
    await fuente.query(
      `UPDATE trading_accounts SET connection_status = 'DESCONECTADA', disconnected_at = now() - interval '30 days'
        WHERE id = $1`,
      [reciente.body.id],
    );

    const [ticket] = (await fuente.query(
      `INSERT INTO tickets (user_id, topic, subject, status, resolved_at, closed_at)
       VALUES ($1, 'OTRO', 'Ticket viejo', 'CERRADO', now() - interval '26 months', now() - interval '25 months')
       RETURNING id`,
      [cliente.usuario.id],
    )) as { id: string }[];
    const [mensaje] = (await fuente.query(
      `INSERT INTO ticket_messages (ticket_id, author_id, body) VALUES ($1, $2, 'Hola') RETURNING id`,
      [ticket!.id, cliente.usuario.id],
    )) as { id: string }[];
    const [archivo] = (await fuente.query(
      `INSERT INTO files (owner_user_id, purpose, ticket_message_id, storage_key, original_name, mime, size_bytes, sha256)
       VALUES ($1, 'TICKET_ADJUNTO', $2, $3, 'captura.png', 'image/png', 10, '\\x00')
       RETURNING id`,
      [cliente.usuario.id, mensaje!.id, `prueba/${hashNuevo()}`],
    )) as { id: string }[];
    await fuente.query(
      `UPDATE notifications SET created_at = now() - interval '13 months', status = 'ENVIADA', sent_at = now()
        WHERE recipient = $1 AND template = 'verificar-correo'`,
      [cliente.correo],
    );
    await fuente.query(
      `UPDATE user_devices SET last_seen_at = now() - interval '13 months' WHERE user_id = $1`,
      [cliente.usuario.id],
    );

    const resultado = await new BorradoDatos(fuente).ejecutar();
    expect(resultado.contrasenas).toBeGreaterThanOrEqual(1);
    expect(resultado.tickets).toBeGreaterThanOrEqual(1);

    const cuentas = (await fuente.query(
      `SELECT id, master_password_enc IS NULL AS sin_clave, passwords_purged_at IS NOT NULL AS purgada
         FROM trading_accounts WHERE id = ANY($1::uuid[])`,
      [[vieja.body.id, reciente.body.id]],
    )) as { id: string; sin_clave: boolean; purgada: boolean }[];
    expect(cuentas.find((c) => c.id === vieja.body.id)).toMatchObject({
      sin_clave: true,
      purgada: true,
    });
    expect(cuentas.find((c) => c.id === reciente.body.id)).toMatchObject({
      sin_clave: false,
      purgada: false,
    });

    expect(await fuente.query(`SELECT 1 FROM tickets WHERE id = $1`, [ticket!.id])).toHaveLength(0);
    const [adjunto] = (await fuente.query(
      `SELECT ticket_message_id, delete_after IS NOT NULL AS por_borrar FROM files WHERE id = $1`,
      [archivo!.id],
    )) as { ticket_message_id: string | null; por_borrar: boolean }[];
    expect(adjunto).toEqual({ ticket_message_id: null, por_borrar: true });

    expect((await correos({ correo: cliente.correo }))['verificar-correo']).toBeUndefined();
    expect(
      await fuente.query(`SELECT 1 FROM user_devices WHERE user_id = $1`, [cliente.usuario.id]),
    ).toHaveLength(0);
    // Las autorizaciones se conservan: son la prueba de lo que el cliente aceptó.
    expect(
      (await fuente.query(`SELECT 1 FROM consents WHERE user_id = $1`, [cliente.usuario.id]))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('alertas a los admins', () => {
  it('avisan una vez de un pago sin verificar hace más de una hora, de un pico de ingresos fallidos y de un trabajo que falla', async () => {
    const admin = await adminConSesion(app);
    const alertas = new Alertas(
      fuente,
      app.get(REDIS),
      app.get(AvisosService),
      app.get(AuditoriaService),
    );
    // La cadena de la auditoría cuadra.
    expect(await alertas.verificarAuditoria()).toBe(true);
    const cliente = await clienteConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    // La blockchain no la encuentra: queda sin verificar.
    await cliente.web
      .post(`/ordenes/${orden.body.numero}/reportar`, { hash: hashNuevo() })
      .expect(200);
    await app.get(VerificacionPagos).verificarPendientes();

    expect((await alertas.revisar()).pagos).toBe(0);
    await fuente.query(
      `UPDATE payment_orders SET reported_at = now() - interval '61 minutes' WHERE number = $1`,
      [orden.body.numero],
    );

    // Ingresos fallidos de verdad, más el contador de la hora anterior.
    await comoLaWeb(app)
      .post('/auth/ingresar', { correo: cliente.correo, contrasena: 'no es la contraseña' })
      .expect(401);
    const redis = app.get(REDIS);
    expect(Number(await redis.get(claveIngresosFallidos(new Date())))).toBeGreaterThan(0);
    const anterior = new Date(Date.now() - 60 * 60_000);
    await redis.set(claveIngresosFallidos(anterior), '120');

    await alertas.revisar();
    await alertas.revisar();
    await alertas.trabajoFallido('verificar-pagos', new Error('TronGrid no responde'));
    await alertas.trabajoFallido('verificar-pagos', new Error('TronGrid no responde'));
    await redis.del(claveIngresosFallidos(anterior));

    const avisos = (await fuente.query(
      `SELECT template, payload FROM notifications
        WHERE user_id = $1 AND template IN ('pago-atascado', 'ingresos-fallidos', 'trabajo-fallido')
        ORDER BY template`,
      [admin.usuario.id],
    )) as { template: string; payload: Record<string, string> }[];
    expect(avisos.map((a) => a.template)).toEqual([
      'ingresos-fallidos',
      'pago-atascado',
      'trabajo-fallido',
    ]);
    expect(avisos[0]!.payload.total).toBe('120');
    expect(avisos[1]!.payload).toMatchObject({
      orden: orden.body.numero,
      monto: 'USD 120 en USDT',
    });
    expect(avisos[2]!.payload).toMatchObject({
      trabajo: 'verificar-pagos',
      error: 'TronGrid no responde',
    });
  });
});
