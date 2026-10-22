import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CONTEXTO_SECRETO_AVISO } from '../src/avisos/avisos.service.js';
import { Notification, TradingAccount, User } from '../src/database/entidades/index.js';
import { CONTEXTO_CONTRASENA_OPERATIVA } from '../src/licencias/cuentas.service.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { VencimientoOrdenes } from '../src/licencias/vencimiento-ordenes.js';
import { CifradoService } from '../src/seguridad/cifrado.service.js';
import { comoLaWeb, crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
let cifrado: CifradoService;

/** USD 125.400 por BTC: así los montos de las pruebas no dependen del mercado. */
const PRECIO_BTC_CENTAVOS = 12_540_000n;

beforeAll(async () => {
  app = await crearApp((c) =>
    c.overrideProvider(PrecioBtcService).useValue({ cotizar: async () => PRECIO_BTC_CENTAVOS }),
  );
  fuente = app.get(getDataSourceToken());
  cifrado = app.get(CifradoService);
});

afterAll(async () => {
  await app.close();
});

let consecutivo = 0;

/** Un cliente nuevo que ya confirmó su correo e ingresó. */
async function clienteConSesion() {
  consecutivo += 1;
  const unico = `${Date.now()}${consecutivo}`;
  const correo = `cliente.cuentas.${unico}@correo.co`;
  const contrasena = 'Una contraseña bien larga 7!';
  await comoLaWeb(app)
    .post('/auth/registro', {
      nombre: 'Laura Gómez Restrepo',
      cedula: unico.slice(-10),
      correo,
      telefono: `31${unico.slice(-8)}`,
      contrasena,
      aceptaTerminos: true,
      aceptaDatos: true,
      aceptaRiesgo: true,
    })
    .expect(202);
  const aviso = await fuente
    .getRepository(Notification)
    .findOneByOrFail({ recipient: correo, template: 'verificar-correo' });
  const enlace = cifrado.descifrar(aviso.secretEnc!, CONTEXTO_SECRETO_AVISO);
  await comoLaWeb(app).post('/auth/verificar-correo', { token: enlace }).expect(200);
  const ingreso = await comoLaWeb(app).post('/auth/ingresar', { correo, contrasena }).expect(200);
  const usuario = await fuente.getRepository(User).findOneByOrFail({ email: correo });
  return { web: comoLaWeb(app, { token: ingreso.body.token as string }), usuario, correo };
}

let numeroCuenta = 50_000_000;
function datosCuenta(cambios: Record<string, string> = {}) {
  numeroCuenta += 1;
  return {
    titular: 'Laura Gómez Restrepo',
    broker: 'JustMarkets',
    servidor: 'JustMarkets-Live',
    numero: String(numeroCuenta),
    contrasenaOperativa: 'operativa-secreta',
    contrasenaInversor: 'inversor-secreta',
    ...cambios,
  };
}

/** Pone una licencia activa con un plan y un vencimiento, como quedará cuando se apruebe un pago (etapa 4). */
async function activarLicencia(cuentaId: string, plan: string, fin: Date) {
  await fuente.query(
    `UPDATE licenses SET status = 'ACTIVA', plan_id = (SELECT id FROM plans WHERE code = $2),
       starts_at = $3, ends_at = $4, grace_ends_at = $4::timestamptz + interval '3 days'
     WHERE trading_account_id = $1`,
    [cuentaId, plan, new Date(fin.getTime() - 30 * 86_400_000), fin],
  );
}

describe('cuentas de trading', () => {
  it('el cliente agrega una cuenta: queda con la licencia por pagar y las contraseñas cifradas', async () => {
    const { web } = await clienteConSesion();
    const datos = datosCuenta({ broker: '  JustMarkets ', servidor: 'JustMarkets-Live' });
    const respuesta = await web.post('/cuentas', datos).expect(201);
    expect(respuesta.body).toMatchObject({
      titular: 'Laura Gómez Restrepo',
      broker: 'JustMarkets',
      numero: datos.numero,
      conexion: 'SIN_LICENCIA',
      licencia: { estado: 'PENDIENTE_PAGO', plan: null, periodos: [] },
      ordenAbierta: null,
    });
    // Las contraseñas nunca vuelven al cliente…
    expect(JSON.stringify(respuesta.body)).not.toContain('operativa-secreta');
    // …y en la base de datos están cifradas.
    const guardada = await fuente
      .getRepository(TradingAccount)
      .createQueryBuilder('c')
      .addSelect('c.masterPasswordEnc')
      .where('c.id = :id', { id: respuesta.body.id })
      .getOneOrFail();
    expect(guardada.masterPasswordEnc!.toString('utf8')).not.toContain('operativa-secreta');
    expect(cifrado.descifrar(guardada.masterPasswordEnc!, CONTEXTO_CONTRASENA_OPERATIVA)).toBe(
      'operativa-secreta',
    );

    const lista = await web.get('/cuentas').expect(200);
    expect(lista.body.cuentas).toHaveLength(1);
    expect(lista.body.planes.map((p: { codigo: string }) => p.codigo)).toEqual([
      'MENSUAL',
      'SEMESTRAL',
    ]);
    expect(lista.body.diasGracia).toBe(3);
  });

  it('una cuenta de trading no puede estar en dos clientes, aunque se escriba distinto', async () => {
    const ana = await clienteConSesion();
    const beto = await clienteConSesion();
    const datos = datosCuenta();
    await ana.web.post('/cuentas', datos).expect(201);

    const repetida = await ana.web.post('/cuentas', datos).expect(400);
    expect(repetida.body.campos.numero).toMatch(/Ya agregaste/);

    const ajena = await beto.web
      .post('/cuentas', { ...datos, broker: 'just markets', servidor: 'justmarkets live' })
      .expect(400);
    expect(ajena.body.campos.numero).toMatch(/ya está registrada/);
  });

  it('valida los datos y rechaza campos de más', async () => {
    const { web } = await clienteConSesion();
    const malo = await web.post('/cuentas', datosCuenta({ numero: '12ab' })).expect(400);
    expect(malo.body.codigo).toBe('DATOS_INVALIDOS');
    await web.post('/cuentas', { ...datosCuenta(), connectionStatus: 'CONECTADA' }).expect(400);
  });

  it('nadie ve ni toca las cuentas de otro cliente, y un admin no usa estas rutas', async () => {
    const ana = await clienteConSesion();
    const beto = await clienteConSesion();
    const cuenta = await ana.web.post('/cuentas', datosCuenta()).expect(201);
    await beto.web.get(`/cuentas/${cuenta.body.id}`).expect(404);
    await beto.web.put(`/cuentas/${cuenta.body.id}`, datosCuenta()).expect(404);
    await beto.web.delete(`/cuentas/${cuenta.body.id}`).expect(404);
    await beto.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(404);
    const orden = await ana.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    await beto.web.get(`/ordenes/${orden.body.numero}`).expect(404);
    await beto.web.post(`/ordenes/${orden.body.numero}/cancelar`).expect(404);
    await comoLaWeb(app).get('/cuentas').expect(401);
  });

  it('si cambian los datos de una cuenta conectada, vuelve a "por conectar" y se avisa por correo', async () => {
    const { web, correo } = await clienteConSesion();
    const datos = datosCuenta();
    const cuenta = await web.post('/cuentas', datos).expect(201);
    await fuente.query(
      `UPDATE trading_accounts SET connection_status = 'CONECTADA' WHERE id = $1`,
      [cuenta.body.id],
    );

    // Solo mayúsculas en el broker: no es un cambio.
    const igual = await web
      .put(`/cuentas/${cuenta.body.id}`, {
        ...datos,
        broker: 'JUSTMARKETS',
        contrasenaOperativa: undefined,
        contrasenaInversor: undefined,
      })
      .expect(200);
    expect(igual.body.conexion).toBe('CONECTADA');

    const editada = await web
      .put(`/cuentas/${cuenta.body.id}`, {
        titular: datos.titular,
        broker: datos.broker,
        servidor: datos.servidor,
        numero: datos.numero,
        contrasenaOperativa: 'otra-operativa',
      })
      .expect(200);
    expect(editada.body.conexion).toBe('POR_CONECTAR');
    const aviso = await fuente
      .getRepository(Notification)
      .findOneByOrFail({ recipient: correo, template: 'cuenta-trading-cambiada' });
    expect(aviso.payload).toMatchObject({ numero: datos.numero, reconectar: 'si' });
    expect(JSON.stringify(aviso.payload)).not.toContain('otra-operativa');
  });

  it('se puede quitar una cuenta sin pagar; una con licencia activa no', async () => {
    const { web } = await clienteConSesion();
    const sinPagar = await web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await web
      .post('/ordenes', { cuentaId: sinPagar.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    await web.delete(`/cuentas/${sinPagar.body.id}`).expect(204);
    await web.get(`/cuentas/${sinPagar.body.id}`).expect(404);
    const cancelada = await web.get(`/ordenes/${orden.body.numero}`).expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    const [borrada] = (await fuente.query(
      `SELECT master_password_enc, passwords_purged_at FROM trading_accounts WHERE id = $1`,
      [sinPagar.body.id],
    )) as { master_password_enc: Buffer | null; passwords_purged_at: Date | null }[];
    expect(borrada!.master_password_enc).toBeNull();
    expect(borrada!.passwords_purged_at).not.toBeNull();

    const activa = await web.post('/cuentas', datosCuenta()).expect(201);
    await activarLicencia(activa.body.id, 'MENSUAL', new Date(Date.now() + 10 * 86_400_000));
    const enUso = await web.delete(`/cuentas/${activa.body.id}`).expect(409);
    expect(enUso.body.codigo).toBe('CUENTA_EN_USO');
  });
});

describe('perfil', () => {
  it('muestra los datos del cliente con la cédula enmascarada', async () => {
    const { web, correo, usuario } = await clienteConSesion();
    const perfil = await web.get('/auth/perfil').expect(200);
    expect(perfil.body).toMatchObject({
      nombre: 'Laura Gómez Restrepo',
      correo,
      cedulaUltimos4: usuario.cedulaLast4,
      segundoFactor: false,
    });
    expect(perfil.body.telefono).toMatch(/^\+57/);
    expect(Object.keys(perfil.body)).not.toContain('cedula');
  });
});

describe('órdenes de pago', () => {
  it('una orden en USDT copia el precio, la dirección vigente y vale una hora', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const antes = Date.now();
    const orden = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'SEMESTRAL', moneda: 'USDT' })
      .expect(201);
    expect(orden.body).toMatchObject({
      tipo: 'NUEVA',
      estado: 'PENDIENTE',
      moneda: 'USDT',
      red: 'TRON',
      direccion: 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x',
      montoUsdCentavos: 49_900,
      precioBtcUsd: null,
      confirmacionesNecesarias: 20,
      vencimientoSiSeAprueba: null,
      plan: { codigo: 'SEMESTRAL', meses: 6, mesesObsequio: 0 },
      cuenta: { id: cuenta.body.id },
    });
    expect(orden.body.numero).toMatch(/^DTP-\d{6}$/);
    // En USDT se pide el precio exacto: USD 499 son 499 USDT.
    expect(orden.body.monto).toBe('499');
    const minutos = (new Date(orden.body.expiraEn).getTime() - antes) / 60_000;
    expect(minutos).toBeGreaterThan(59);
    expect(minutos).toBeLessThanOrEqual(60.1);

    const lista = await web.get('/cuentas').expect(200);
    expect(lista.body.cuentas[0].ordenAbierta).toMatchObject({
      numero: orden.body.numero,
      estado: 'PENDIENTE',
    });
  });

  it('en BTC fija el precio del momento y redondea los satoshis hacia arriba', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'SEMESTRAL', moneda: 'BTC' })
      .expect(201);
    expect(orden.body).toMatchObject({
      moneda: 'BTC',
      red: 'BITCOIN',
      direccion: '1H8xfingRtsTvhnf4PosyhXvacXdGVWea1',
      precioBtcUsd: '125400.00',
      confirmacionesNecesarias: 2,
      plan: { codigo: 'SEMESTRAL', meses: 6, mesesObsequio: 0 },
    });
    // USD 499 / 125.400 = 0,00397926… BTC, redondeado hacia arriba (397.927 satoshis), menos de 1 a 999 satoshis.
    const satoshis = Math.round(Number(orden.body.monto) * 1e8);
    expect(satoshis).toBeGreaterThanOrEqual(397_927 - 999);
    expect(satoshis).toBeLessThanOrEqual(397_926);
  });

  it('en USDT todas las órdenes piden el precio exacto; en BTC dos abiertas nunca piden lo mismo', async () => {
    const usdt = new Set<string>();
    const btc = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { web } = await clienteConSesion();
      const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
      const enUsdt = await web
        .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
        .expect(201);
      usdt.add(enUsdt.body.monto as string);
      const otra = await web.post('/cuentas', datosCuenta()).expect(201);
      const enBtc = await web
        .post('/ordenes', { cuentaId: otra.body.id, plan: 'MENSUAL', moneda: 'BTC' })
        .expect(201);
      btc.add(enBtc.body.monto as string);
    }
    expect([...usdt]).toEqual(['120']);
    expect(btc.size).toBe(6);
  });

  it('cambiar de moneda o de plan reemplaza la orden pendiente', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const primera = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const segunda = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'BTC' })
      .expect(201);
    expect(segunda.body.numero).not.toBe(primera.body.numero);
    const vieja = await web.get(`/ordenes/${primera.body.numero}`).expect(200);
    expect(vieja.body.estado).toBe('CANCELADA');
  });

  it('el cliente reporta el hash; no se repite en otra orden y bloquea crear otra para la cuenta', async () => {
    const ana = await clienteConSesion();
    const beto = await clienteConSesion();
    const cuentaAna = await ana.web.post('/cuentas', datosCuenta()).expect(201);
    const cuentaBeto = await beto.web.post('/cuentas', datosCuenta()).expect(201);
    const ordenAna = await ana.web
      .post('/ordenes', { cuentaId: cuentaAna.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const ordenBeto = await beto.web
      .post('/ordenes', { cuentaId: cuentaBeto.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);

    const corto = await ana.web
      .post(`/ordenes/${ordenAna.body.numero}/reportar`, { hash: 'abc123' })
      .expect(400);
    expect(corto.body.campos.hash).toMatch(/64/);

    const hash = `${Date.now().toString(16)}`.padEnd(64, 'a');
    const reportada = await ana.web
      .post(`/ordenes/${ordenAna.body.numero}/reportar`, { hash: ` ${hash.toUpperCase()} ` })
      .expect(200);
    expect(reportada.body).toMatchObject({
      estado: 'REPORTADA',
      hash,
      verificacion: 'SIN_VERIFICAR',
      enlaceExplorador: `https://tronscan.org/#/transaction/${hash}`,
    });

    const repetido = await beto.web
      .post(`/ordenes/${ordenBeto.body.numero}/reportar`, { hash })
      .expect(400);
    expect(repetido.body.campos.hash).toMatch(/ya se reportó/);

    const otra = await ana.web
      .post('/ordenes', { cuentaId: cuentaAna.body.id, plan: 'SEMESTRAL', moneda: 'USDT' })
      .expect(409);
    expect(otra.body.codigo).toBe('PAGO_EN_REVISION');
    const cancelar = await ana.web.post(`/ordenes/${ordenAna.body.numero}/cancelar`).expect(409);
    expect(cancelar.body.codigo).toBe('NO_CANCELABLE');
  });

  it('la orden expira sola a la hora y ya no acepta el hash', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const orden = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    await fuente.query(
      `UPDATE payment_orders SET created_at = now() - interval '61 minutes',
         expires_at = now() - interval '1 minute' WHERE number = $1`,
      [orden.body.numero],
    );
    // Antes de que pase el worker, ya se muestra como expirada.
    const vista = await web.get(`/ordenes/${orden.body.numero}`).expect(200);
    expect(vista.body.estado).toBe('EXPIRADA');

    const expiradas = await new VencimientoOrdenes(fuente).expirar();
    expect(expiradas).toBeGreaterThanOrEqual(1);
    const [fila] = (await fuente.query(`SELECT status FROM payment_orders WHERE number = $1`, [
      orden.body.numero,
    ])) as { status: string }[];
    expect(fila!.status).toBe('EXPIRADA');

    const tarde = await web
      .post(`/ordenes/${orden.body.numero}/reportar`, { hash: 'b'.repeat(64) })
      .expect(409);
    expect(tarde.body.codigo).toBe('ORDEN_EXPIRADA');
  });

  it('con la licencia activa: al mismo plan es renovación y a uno más largo, cambio de plan', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const fin = new Date('2026-12-15T15:00:00Z');
    await activarLicencia(cuenta.body.id, 'MENSUAL', fin);

    const renovar = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    expect(renovar.body.tipo).toBe('RENOVACION');
    expect(renovar.body.vencimientoSiSeAprueba).toBe('2027-01-15T15:00:00.000Z');

    const cambio = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'SEMESTRAL', moneda: 'USDT' })
      .expect(201);
    expect(cambio.body.tipo).toBe('CAMBIO_DE_PLAN');
    // Seis meses, sumados al vencimiento actual.
    expect(cambio.body.vencimientoSiSeAprueba).toBe('2027-06-15T15:00:00.000Z');

    const lista = await web.get('/cuentas').expect(200);
    expect(lista.body.cuentas[0].licencia).toMatchObject({
      estado: 'ACTIVA',
      plan: { codigo: 'MENSUAL' },
      fin: fin.toISOString(),
    });
  });

  it('la prueba y la trimestral no se compran y sin dirección activa no se crea la orden', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    // La prueba se quitó y la trimestral ya no se vende (2026-10-15).
    await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'PRUEBA', moneda: 'USDT' })
      .expect(400);
    await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'TRIMESTRAL', moneda: 'USDT' })
      .expect(400);

    await fuente.query(
      `UPDATE deposit_addresses SET status = 'INACTIVA' WHERE network = 'TRON' AND status = 'ACTIVA'`,
    );
    try {
      const sin = await web
        .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
        .expect(503);
      expect(sin.body.codigo).toBe('SIN_DIRECCION');
    } finally {
      await fuente.query(
        `UPDATE deposit_addresses SET status = 'ACTIVA' WHERE network = 'TRON' AND status = 'INACTIVA'`,
      );
    }
  });

  it('el historial trae las órdenes del cliente, de la más nueva a la más vieja', async () => {
    const { web } = await clienteConSesion();
    const cuenta = await web.post('/cuentas', datosCuenta()).expect(201);
    const primera = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    const segunda = await web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'SEMESTRAL', moneda: 'USDT' })
      .expect(201);
    const lista = await web.get('/ordenes').expect(200);
    expect(lista.body.map((o: { numero: string }) => o.numero)).toEqual([
      segunda.body.numero,
      primera.body.numero,
    ]);
  });
});
