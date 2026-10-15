import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import type { Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
import { adminConSesion, clienteConSesion, datosCuenta, hashNuevo } from './ayudas.js';
import { comoLaWeb, crearApp } from './crear-app.js';

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

/** Una orden mensual en USDT, pagada exacta y reportada. */
async function reportar(cliente: Cliente, cuentaId: string) {
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
        unidades: BigInt(orden.body.montoUsdCentavos) * 10_000n,
      },
    ],
    otraMoneda: false,
    remitentes: [],
  });
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await app.get(VerificacionPagos).verificarPendientes();
  return orden.body.numero as string;
}

describe('eliminar un cliente', () => {
  it('anonimiza sus datos, conserva sus pagos y deja la cuenta conectada por desconectar', async () => {
    const admin = await adminConSesion(app);
    const cedula = String(Date.now()).slice(-9);
    const correo = `se.va.${Date.now()}@correo.co`;
    const cliente = await clienteConSesion(app, { cedula, correo, nombre: 'Marta Ruiz Peña' });

    // Una cuenta pagada y conectada, otra sin pagar, y un ticket.
    const conectada = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    const pagada = await reportar(cliente, conectada.body.id as string);
    await admin.web.post(`/admin/pagos/${pagada}/aprobar`, {}).expect(200);
    await admin.web.post(`/admin/cuentas/${conectada.body.id}/conectada`, {}).expect(200);
    const otra = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
    await cliente.web
      .post('/soporte', {
        tema: 'OTRO',
        asunto: 'Quiero eliminar mi cuenta',
        mensaje: 'Por favor eliminen mi cuenta y mis datos.',
      })
      .expect(201);
    const enRevision = await reportar(cliente, otra.body.id as string);

    // Un cliente no puede; un admin necesita el código; con un pago en revisión, no.
    await cliente.web
      .post(`/admin/clientes/${cliente.usuario.id}/eliminar`, { motivo: 'x'.repeat(12) })
      .expect(403);
    const motivo = { motivo: 'Lo pidió en el ticket de soporte.' };
    const sinCodigo = await admin.web
      .post(`/admin/clientes/${cliente.usuario.id}/eliminar`, motivo)
      .expect(403);
    expect(sinCodigo.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    await admin.confirmar();
    const bloqueado = await admin.web
      .post(`/admin/clientes/${cliente.usuario.id}/eliminar`, motivo)
      .expect(409);
    expect(bloqueado.body.codigo).toBe('PAGO_EN_REVISION');
    await admin.web
      .post(`/admin/pagos/${enRevision}/rechazar`, {
        motivo: 'El cliente pidió eliminar su cuenta.',
      })
      .expect(200);

    const eliminado = await admin.web
      .post(`/admin/clientes/${cliente.usuario.id}/eliminar`, motivo)
      .expect(200);
    expect(eliminado.body).toEqual({ porDesconectar: 1 });

    const [usuario] = (await fuente.query(
      `SELECT status, full_name, email, cedula_enc, cedula_hmac, cedula_last4, phone_e164, password_hash
         FROM users WHERE id = $1`,
      [cliente.usuario.id],
    )) as Record<string, unknown>[];
    expect(usuario).toEqual({
      status: 'DELETED',
      full_name: 'Cliente eliminado',
      email: `eliminado-${cliente.usuario.id}@doctraderpro.invalid`,
      cedula_enc: null,
      cedula_hmac: null,
      cedula_last4: null,
      phone_e164: null,
      password_hash: null,
    });

    // Su sesión se cerró y ya no puede ingresar.
    await cliente.web.get('/cuentas').expect(401);
    await comoLaWeb(app)
      .post('/auth/ingresar', { correo, contrasena: 'una contraseña bien larga' })
      .expect(401);

    // La cuenta conectada queda por desconectar; la otra, borrada. Ninguna conserva titular ni contraseñas.
    const cuentas = (await fuente.query(
      `SELECT id, holder_name, connection_status, deleted_at IS NOT NULL AS borrada,
              master_password_enc IS NULL AND investor_password_enc IS NULL AS sin_claves
         FROM trading_accounts WHERE user_id = $1`,
      [cliente.usuario.id],
    )) as {
      id: string;
      holder_name: string;
      connection_status: string;
      borrada: boolean;
      sin_claves: boolean;
    }[];
    expect(cuentas.find((c) => c.id === conectada.body.id)).toMatchObject({
      holder_name: 'Cliente eliminado',
      connection_status: 'POR_DESCONECTAR',
      borrada: false,
      sin_claves: true,
    });
    expect(cuentas.find((c) => c.id === otra.body.id)).toMatchObject({
      borrada: true,
      sin_claves: true,
    });
    const listas = await admin.web.get('/admin/cuentas').expect(200);
    expect(
      listas.body.porDesconectar.find((c: { id: string }) => c.id === conectada.body.id),
    ).toBeDefined();

    // Licencia terminada, ticket borrado, pagos conservados, aviso y auditoría.
    const [licencia] = (await fuente.query(
      `SELECT status FROM licenses WHERE trading_account_id = $1`,
      [conectada.body.id],
    )) as { status: string }[];
    expect(licencia!.status).toBe('VENCIDA');
    expect(
      await fuente.query(`SELECT 1 FROM tickets WHERE user_id = $1`, [cliente.usuario.id]),
    ).toHaveLength(0);
    const ordenes = (await fuente.query(
      `SELECT status FROM payment_orders WHERE user_id = $1 ORDER BY created_at`,
      [cliente.usuario.id],
    )) as { status: string }[];
    expect(ordenes.map((o) => o.status)).toEqual(['APROBADA', 'RECHAZADA']);
    const avisos = (await fuente.query(
      `SELECT template, user_id FROM notifications WHERE recipient = $1`,
      [correo],
    )) as { template: string; user_id: string | null }[];
    expect(avisos).toEqual([{ template: 'cuenta-eliminada', user_id: null }]);
    const [registro] = (await fuente.query(
      `SELECT metadata FROM audit_log WHERE action = 'cliente.eliminado' AND target_id = $1`,
      [cliente.usuario.id],
    )) as { metadata: Record<string, unknown> }[];
    expect(registro!.metadata).toMatchObject({
      motivo: motivo.motivo,
      porDesconectar: 1,
      tickets: 1,
    });
    expect(JSON.stringify(registro!.metadata)).not.toContain('Marta');

    // Al desconectarla en Social Trader Tools, la cuenta queda borrada.
    await admin.web.post(`/admin/cuentas/${conectada.body.id}/desconectada`, {}).expect(200);
    const [desconectada] = (await fuente.query(
      `SELECT deleted_at IS NOT NULL AS borrada FROM trading_accounts WHERE id = $1`,
      [conectada.body.id],
    )) as { borrada: boolean }[];
    expect(desconectada!.borrada).toBe(true);

    // No se elimina dos veces, y la persona puede registrarse otra vez con el mismo correo y cédula.
    await admin.web.post(`/admin/clientes/${cliente.usuario.id}/eliminar`, motivo).expect(409);
    const nuevo = await clienteConSesion(app, { cedula, correo, nombre: 'Marta Ruiz Peña' });
    expect(nuevo.usuario.id).not.toBe(cliente.usuario.id);
  });
});
