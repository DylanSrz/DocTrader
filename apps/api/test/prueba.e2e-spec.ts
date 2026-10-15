import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditLog, Notification } from '../src/database/entidades/index.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { VencimientoLicencias } from '../src/licencias/vencimiento-licencias.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import type { Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { ProveedorSms, type SmsDeConsola } from '../src/prueba/sms.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';
import { crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
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
});

afterAll(async () => {
  await app.close();
});

type Cliente = Awaited<ReturnType<typeof clienteConSesion>>;
type Admin = Awaited<ReturnType<typeof adminConSesion>>;

let consecutivo = 0;
/** Datos de una persona nueva: cédula, correo, teléfono y dispositivo que nadie más usa. */
function persona() {
  consecutivo += 1;
  const id = `${Date.now()}`.slice(-7) + String(consecutivo).padStart(2, '0');
  return {
    cedula: `9${id}`,
    correo: `prueba.${id}@correo.co`,
    telefono: `31${id.slice(-8)}`,
    dispositivo: `dispositivo-${id}-abcdef`,
  };
}

async function verificarTelefono(cliente: Cliente) {
  await cliente.web.post('/prueba/telefono/codigo', {}).expect(200);
  const sms = app.get(ProveedorSms) as SmsDeConsola;
  const codigo = sms.ultimos.get(cliente.usuario.phoneE164!);
  expect(codigo).toMatch(/^\d{6}$/);
  await cliente.web.post('/prueba/telefono/verificar', { codigo }).expect(200);
}

/** Paga una orden con el monto exacto y la aprueba el admin. */
async function pagarYAprobar(cliente: Cliente, admin: Admin, cuentaId: string, plan: string) {
  const orden = await cliente.web.post('/ordenes', { cuentaId, plan, moneda: 'USDT' }).expect(201);
  const hash = hashNuevo();
  blockchain.set(hash, {
    encontrada: true,
    exitosa: true,
    hora: new Date(),
    bloque: 100,
    confirmaciones: 25,
    pagos: [
      { direccion: orden.body.direccion, unidades: BigInt(orden.body.montoUsdCentavos) * 10_000n },
    ],
    otraMoneda: false,
    remitentes: [`TKfz7Pu3jtxWrfHzVeozQjXsb3RfuUHGE${consecutivo % 10}`],
  });
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await app.get(VerificacionPagos).verificarPendientes();
  await admin.web.post(`/admin/pagos/${orden.body.numero}/aprobar`, {}).expect(200);
  return orden.body as {
    numero: string;
    tipo: string;
    montoUsdCentavos: number;
    creditoUsdCentavos: number;
  };
}

async function licencia(cuentaId: string) {
  const [fila] = (await fuente.query(
    `SELECT l.*, t.connection_status, t.locked_until FROM licenses l
       JOIN trading_accounts t ON t.id = l.trading_account_id WHERE t.id = $1`,
    [cuentaId],
  )) as Record<string, unknown>[];
  return fila!;
}

/** Lo que hará el borrado de la cuenta (etapa 8): el cliente desaparece, las huellas de su prueba quedan. */
async function borrarCliente(usuarioId: string) {
  await fuente.query(`UPDATE trading_accounts SET deleted_at = now() WHERE user_id = $1`, [
    usuarioId,
  ]);
  await fuente.query(
    `UPDATE users SET status = 'DELETED', deleted_at = now(), email = 'borrado.' || id || '@borrado',
            email_canonical = 'borrado.' || id || '@borrado', cedula_enc = NULL, cedula_last4 = NULL,
            cedula_hmac = decode(md5(random()::text), 'hex'), phone_e164 = 'borrado.' || id
      WHERE id = $1`,
    [usuarioId],
  );
}

describe('licencia de prueba', () => {
  let admin: Admin;

  beforeAll(async () => {
    admin = await adminConSesion(app);
  });

  it('pedirla exige el teléfono verificado por SMS', async () => {
    const cliente = await clienteConSesion(app, persona());
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const estado = await cliente.web.get('/prueba').expect(200);
    expect(estado.body).toMatchObject({
      disponible: true,
      precioUsdCentavos: 5_000,
      dias: 15,
      correoVerificado: true,
      telefonoVerificado: false,
      cuentas: [{ id: cuenta.body.id }],
      solicitud: null,
    });
    const sin = await cliente.web
      .post('/prueba/solicitud', { cuentaId: cuenta.body.id })
      .expect(409);
    expect(sin.body.codigo).toBe('CONTACTO_SIN_VERIFICAR');

    await cliente.web.post('/prueba/telefono/codigo', {}).expect(200);
    const mal = await cliente.web.post('/prueba/telefono/verificar', { codigo: '000000' });
    expect([400, 200]).toContain(mal.status);
    if (mal.status === 400) expect(mal.body.campos.codigo).toBeDefined();
    const sms = app.get(ProveedorSms) as SmsDeConsola;
    await cliente.web
      .post('/prueba/telefono/verificar', { codigo: sms.ultimos.get(cliente.usuario.phoneE164!) })
      .expect(200);
    const despues = await cliente.web.get('/prueba').expect(200);
    expect(despues.body.telefonoVerificado).toBe(true);
    // Un admin no pide pruebas; un cliente no ve las de los demás.
    await admin.web.get('/prueba').expect(403);
    await cliente.web.get('/admin/pruebas').expect(403);
  });

  it('el SMS tiene límite: 3 códigos por hora al mismo teléfono', async () => {
    const cliente = await clienteConSesion(app, persona());
    for (let i = 0; i < 3; i++) await cliente.web.post('/prueba/telefono/codigo', {}).expect(200);
    const cuarto = await cliente.web.post('/prueba/telefono/codigo', {}).expect(429);
    expect(cuarto.body.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  it('recorrido completo: solicitud, aprobación, pago de USD 50, prueba de 15 días y completar a mensual', async () => {
    const datos = persona();
    const cliente = await clienteConSesion(app, datos);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    await verificarTelefono(cliente);

    // Sin aprobar, la prueba no se paga.
    await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'PRUEBA', moneda: 'USDT' })
      .expect(409);

    const solicitud = await cliente.web
      .post('/prueba/solicitud', { cuentaId: cuenta.body.id })
      .expect(200);
    expect(solicitud.body).toEqual({ estado: 'PENDIENTE', motivos: [] });
    // Una sola solicitud vigente por persona.
    await cliente.web.post('/prueba/solicitud', { cuentaId: cuenta.body.id }).expect(409);

    const lista = await admin.web.get('/admin/pruebas').expect(200);
    const pendiente = lista.body.pendientes.find(
      (p: { cliente: { id: string } }) => p.cliente.id === cliente.usuario.id,
    );
    expect(pendiente).toMatchObject({ estado: 'PENDIENTE', senales: [] });
    const aviso = await fuente
      .getRepository(Notification)
      .findOneBy({ template: 'prueba-solicitada', recipient: admin.usuario.email });
    expect(aviso).not.toBeNull();

    await admin.web.post(`/admin/pruebas/${pendiente.id}/aprobar`).expect(200);
    await admin.web.post(`/admin/pruebas/${pendiente.id}/aprobar`).expect(409);
    const huellas = (await fuente.query(
      `SELECT kind FROM trial_registry WHERE trial_request_id = $1 ORDER BY kind`,
      [pendiente.id],
    )) as { kind: string }[];
    expect(huellas.map((h) => h.kind)).toEqual([
      'CEDULA',
      'CORREO',
      'CUENTA',
      'DISPOSITIVO',
      'NUMERO_CUENTA',
      'TELEFONO',
    ]);
    await fuente
      .getRepository(Notification)
      .findOneByOrFail({ recipient: cliente.correo, template: 'prueba-aprobada' });

    // Durante la solicitud aprobada no se cambia la cuenta de trading.
    await cliente.web
      .put(`/cuentas/${cuenta.body.id}`, { ...datosCuenta(), titular: 'Laura Gómez Restrepo' })
      .expect(409);

    const antes = Date.now();
    const orden = await pagarYAprobar(cliente, admin, cuenta.body.id, 'PRUEBA');
    expect(orden).toMatchObject({ tipo: 'PRUEBA', montoUsdCentavos: 5_000 });
    const enPrueba = await licencia(cuenta.body.id);
    expect(enPrueba).toMatchObject({
      status: 'PRUEBA',
      is_trial: true,
      connection_status: 'POR_CONECTAR',
    });
    const dias = ((enPrueba.ends_at as Date).getTime() - antes) / 86_400_000;
    expect(Math.round(dias)).toBe(15);
    // La prueba no tiene gracia y la cuenta queda bloqueada hasta el final.
    expect(enPrueba.grace_ends_at).toEqual(enPrueba.ends_at);
    expect(enPrueba.locked_until).toEqual(enPrueba.ends_at);
    const billetera = (await fuente.query(
      `SELECT count(*)::int AS n FROM trial_registry WHERE trial_request_id = $1 AND kind = 'BILLETERA'`,
      [pendiente.id],
    )) as { n: number }[];
    expect(billetera[0]!.n).toBe(1);

    // Completar a mensual: paga la diferencia y el mes cuenta desde el inicio de la prueba.
    const completar = await pagarYAprobar(cliente, admin, cuenta.body.id, 'MENSUAL');
    expect(completar).toMatchObject({
      tipo: 'COMPLETAR_PRUEBA',
      creditoUsdCentavos: 5_000,
      montoUsdCentavos: 7_000,
    });
    const activa = await licencia(cuenta.body.id);
    expect(activa).toMatchObject({ status: 'ACTIVA', is_trial: false, locked_until: null });
    expect(activa.starts_at).toEqual(enPrueba.trial_started_at);
    const fin = new Date(enPrueba.trial_started_at as Date);
    fin.setUTCMonth(fin.getUTCMonth() + 1);
    expect((activa.ends_at as Date).toISOString()).toBe(fin.toISOString());
  });

  it('la misma cédula, cuenta, correo o teléfono no pueden pedir otra prueba, aunque se registren de nuevo', async () => {
    const datos = persona();
    const cuentaDatos = datosCuenta();
    const primera = await clienteConSesion(app, datos);
    const cuenta = await primera.web.post('/cuentas', cuentaDatos).expect(201);
    await verificarTelefono(primera);
    await primera.web.post('/prueba/solicitud', { cuentaId: cuenta.body.id }).expect(200);
    const lista = await admin.web.get('/admin/pruebas').expect(200);
    const solicitud = lista.body.pendientes.find(
      (p: { cliente: { id: string } }) => p.cliente.id === primera.usuario.id,
    );
    await admin.web.post(`/admin/pruebas/${solicitud.id}/aprobar`).expect(200);

    // Borra su cuenta y vuelve con los mismos datos, otro dispositivo y la misma cuenta de trading escrita distinto.
    await borrarCliente(primera.usuario.id);
    const segunda = await clienteConSesion(app, { ...datos, dispositivo: persona().dispositivo });
    const otraVez = await segunda.web
      .post('/cuentas', {
        ...cuentaDatos,
        broker: cuentaDatos.broker.toUpperCase(),
        servidor: 'Just Markets-Live',
      })
      .expect(201);
    await verificarTelefono(segunda);
    const bloqueada = await segunda.web
      .post('/prueba/solicitud', { cuentaId: otraVez.body.id })
      .expect(200);
    expect(bloqueada.body.estado).toBe('BLOQUEADA');
    expect(bloqueada.body.motivos).toEqual([
      'Tu cédula ya tuvo una prueba.',
      'Esta cuenta de trading ya tuvo una prueba.',
      'Tu correo ya está ligado a una prueba.',
      'Tu teléfono ya está ligado a una prueba.',
    ]);
    const estado = await segunda.web.get('/prueba').expect(200);
    expect(estado.body.solicitud).toMatchObject({ estado: 'BLOQUEADA' });
    const admins = await admin.web.get('/admin/pruebas').expect(200);
    expect(
      admins.body.bloqueadas.some(
        (b: { cliente: { id: string } }) => b.cliente.id === segunda.usuario.id,
      ),
    ).toBe(true);
    await fuente
      .getRepository(AuditLog)
      .findOneByOrFail({ action: 'prueba.bloqueada', actorId: segunda.usuario.id });

    // Cada dato por separado también bloquea.
    for (const [cambio, motivo] of [
      [{ cedula: datos.cedula }, 'Tu cédula ya tuvo una prueba.'],
      [{ correo: `${datos.correo.split('@')[0]}+otra@correo.co` }, null],
      [{ telefono: datos.telefono }, 'Tu teléfono ya está ligado a una prueba.'],
    ] as const) {
      await borrarCliente(segunda.usuario.id);
      const otra = await clienteConSesion(app, { ...persona(), ...cambio });
      const suya = await otra.web.post('/cuentas', datosCuenta()).expect(201);
      await verificarTelefono(otra);
      const r = await otra.web.post('/prueba/solicitud', { cuentaId: suya.body.id }).expect(200);
      if (motivo) {
        expect(r.body).toEqual({ estado: 'BLOQUEADA', motivos: [motivo] });
      } else {
        // Un correo con "+algo" en otro dominio es otro correo: pasa (en Gmail se normalizaría).
        expect(r.body.estado).toBe('PENDIENTE');
      }
    }
  });

  it('las señales: número de cuenta en otro broker, mismo dispositivo y titular parecido', async () => {
    const datos = persona();
    const cuentaDatos = datosCuenta({ titular: 'Carolina Mejía Ruiz' });
    const primera = await clienteConSesion(app, datos);
    const cuenta = await primera.web.post('/cuentas', cuentaDatos).expect(201);
    await verificarTelefono(primera);
    await primera.web.post('/prueba/solicitud', { cuentaId: cuenta.body.id }).expect(200);
    let lista = await admin.web.get('/admin/pruebas').expect(200);
    const anterior = lista.body.pendientes.find(
      (p: { cliente: { id: string } }) => p.cliente.id === primera.usuario.id,
    );
    await admin.web.post(`/admin/pruebas/${anterior.id}/aprobar`).expect(200);

    // Otra persona, en el mismo navegador, con el mismo número en otro broker y un titular parecido.
    const otra = await clienteConSesion(app, { ...persona(), dispositivo: datos.dispositivo });
    const suya = await otra.web
      .post('/cuentas', {
        ...cuentaDatos,
        titular: 'Carolina Mejía',
        broker: 'IC Markets',
        servidor: 'ICMarketsSC-Live07',
      })
      .expect(201);
    await verificarTelefono(otra);
    const r = await otra.web.post('/prueba/solicitud', { cuentaId: suya.body.id }).expect(200);
    expect(r.body.estado).toBe('PENDIENTE');
    lista = await admin.web.get('/admin/pruebas').expect(200);
    const nueva = lista.body.pendientes.find(
      (p: { cliente: { id: string } }) => p.cliente.id === otra.usuario.id,
    );
    // Puede haber más (números parecidos de otras pruebas, la misma IP): estas tres tienen que estar.
    expect(nueva.senales.map((s: { tipo: string }) => s.tipo)).toEqual(
      expect.arrayContaining(['DISPOSITIVO', 'NUMERO_CUENTA', 'TITULAR']),
    );

    // Rechazar con motivo: le llega al cliente y lo ve en su panel.
    await admin.web.post(`/admin/pruebas/${nueva.id}/rechazar`, { motivo: 'x' }).expect(400);
    await admin.web
      .post(`/admin/pruebas/${nueva.id}/rechazar`, {
        motivo: 'La cuenta ya tuvo una prueba con otro titular.',
      })
      .expect(200);
    const estado = await otra.web.get('/prueba').expect(200);
    expect(estado.body.solicitud).toMatchObject({
      estado: 'RECHAZADA',
      motivoRechazo: 'La cuenta ya tuvo una prueba con otro titular.',
    });
    await fuente
      .getRepository(Notification)
      .findOneByOrFail({ recipient: otra.correo, template: 'prueba-rechazada' });
  });

  it('al terminar los 15 días sin completarla vence y la cuenta pasa a por desconectar', async () => {
    const cliente = await clienteConSesion(app, persona());
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    await verificarTelefono(cliente);
    await cliente.web.post('/prueba/solicitud', { cuentaId: cuenta.body.id }).expect(200);
    const lista = await admin.web.get('/admin/pruebas').expect(200);
    const solicitud = lista.body.pendientes.find(
      (p: { cliente: { id: string } }) => p.cliente.id === cliente.usuario.id,
    );
    await admin.web.post(`/admin/pruebas/${solicitud.id}/aprobar`).expect(200);
    await pagarYAprobar(cliente, admin, cuenta.body.id, 'PRUEBA');
    await admin.web.post(`/admin/cuentas/${cuenta.body.id}/conectada`).expect(200);

    await fuente.query(
      `UPDATE licenses SET ends_at = now() - interval '1 minute', grace_ends_at = now() - interval '1 minute',
              starts_at = now() - interval '15 days', trial_started_at = now() - interval '15 days'
        WHERE trading_account_id = $1`,
      [cuenta.body.id],
    );
    await new VencimientoLicencias(fuente).actualizar();
    expect(await licencia(cuenta.body.id)).toMatchObject({
      status: 'VENCIDA',
      connection_status: 'POR_DESCONECTAR',
    });
    // Vencida, para seguir compra una licencia nueva al precio completo.
    const nueva = await cliente.web
      .post('/ordenes', { cuentaId: cuenta.body.id, plan: 'MENSUAL', moneda: 'USDT' })
      .expect(201);
    expect(nueva.body).toMatchObject({ tipo: 'NUEVA', montoUsdCentavos: 12_000 });
  });
});
