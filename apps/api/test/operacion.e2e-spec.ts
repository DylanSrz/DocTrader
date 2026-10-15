import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AjustesAdminService } from '../src/admin/ajustes-admin.service.js';
import { AuditLog, Notification } from '../src/database/entidades/index.js';
import { PrecioBtcService } from '../src/licencias/precio-btc.service.js';
import { AvisosService } from '../src/avisos/avisos.service.js';
import { VencimientoLicencias } from '../src/licencias/vencimiento-licencias.js';
import { LectorBlockchain } from '../src/pagos/lector-blockchain.service.js';
import type { Lectura } from '../src/pagos/lectura.js';
import { VerificacionPagos } from '../src/pagos/verificacion-pagos.service.js';
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

type Admin = Awaited<ReturnType<typeof adminConSesion>>;

/** Un cliente con una cuenta de trading y su licencia pagada y aprobada (la cuenta queda por conectar). */
async function cuentaPagada(admin: Admin, plan = 'MENSUAL') {
  const cliente = await clienteConSesion(app);
  const datos = datosCuenta();
  const cuenta = await cliente.web.post('/cuentas', datos).expect(201);
  const orden = await cliente.web
    .post('/ordenes', { cuentaId: cuenta.body.id, plan, moneda: 'USDT' })
    .expect(201);
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
    remitentes: [],
  });
  await cliente.web.post(`/ordenes/${orden.body.numero}/reportar`, { hash }).expect(200);
  await app.get(VerificacionPagos).verificarPendientes();
  await admin.web.post(`/admin/pagos/${orden.body.numero}/aprobar`, {}).expect(200);
  const [licencia] = (await fuente.query(`SELECT id FROM licenses WHERE trading_account_id = $1`, [
    cuenta.body.id,
  ])) as { id: string }[];
  return {
    cliente,
    cuentaId: cuenta.body.id as string,
    licenciaId: licencia!.id,
    numero: datos.numero,
    orden: orden.body.numero as string,
    direccion: orden.body.direccion as string,
  };
}

async function conexion(cuentaId: string) {
  const [fila] = (await fuente.query(
    `SELECT t.connection_status, l.status, l.ends_at, l.grace_ends_at
       FROM trading_accounts t JOIN licenses l ON l.trading_account_id = t.id WHERE t.id = $1`,
    [cuentaId],
  )) as { connection_status: string; status: string; ends_at: Date; grace_ends_at: Date }[];
  return fila!;
}

/** Lleva una licencia al pasado: venció hace `dias` días y la gracia también terminó. */
async function vencer(cuentaId: string, dias = 10) {
  await fuente.query(
    `UPDATE licenses SET ends_at = now() - make_interval(days => $2),
            grace_ends_at = now() - make_interval(days => $2 - 3),
            starts_at = now() - make_interval(days => $2 + 30)
      WHERE trading_account_id = $1`,
    [cuentaId, dias],
  );
  await new VencimientoLicencias(fuente, app.get(AvisosService)).actualizar();
}

describe('operación del admin', () => {
  let admin: Admin;

  beforeAll(async () => {
    admin = await adminConSesion(app);
  });

  describe('cuentas por conectar y por desconectar', () => {
    it('la cuenta pagada aparece por conectar con sus datos, sin contraseñas', async () => {
      const { cuentaId, numero, cliente } = await cuentaPagada(admin);
      const listas = await admin.web.get('/admin/cuentas').expect(200);
      const item = listas.body.porConectar.find((c: { id: string }) => c.id === cuentaId);
      expect(item).toMatchObject({
        titular: 'Laura Gómez Restrepo',
        broker: 'JustMarkets',
        servidor: 'JustMarkets-Live',
        numero,
        yaEstuvoConectada: false,
        cliente: { nombre: 'Laura Gómez Restrepo', correo: cliente.correo },
        licencia: { estado: 'ACTIVA', plan: 'Mensual' },
        pago: { moneda: 'USDT' },
      });
      expect(JSON.stringify(listas.body)).not.toContain('operativa-secreta');

      // Un cliente no ve las listas.
      await cliente.web.get('/admin/cuentas').expect(403);
    });

    it('ver las contraseñas exige el segundo factor reciente y queda en la auditoría', async () => {
      const { cuentaId } = await cuentaPagada(admin);
      const sin = await admin.web.post(`/admin/cuentas/${cuentaId}/contrasenas`).expect(403);
      expect(sin.body.codigo).toBe('CONFIRMACION_REQUERIDA');

      await admin.confirmar();
      const con = await admin.web.post(`/admin/cuentas/${cuentaId}/contrasenas`).expect(200);
      expect(con.body).toEqual({ operativa: 'operativa-secreta', inversor: 'inversor-secreta' });
      expect(con.headers['cache-control']).toBe('no-store');

      const auditoria = await fuente.getRepository(AuditLog).findOneByOrFail({
        action: 'cuenta.ver_contrasenas',
        targetId: cuentaId,
      });
      expect(auditoria.actorId).toBe(admin.usuario.id);
      expect(JSON.stringify(auditoria.metadata)).not.toContain('secreta');
    });

    it('marcarla conectada la saca de la lista y le avisa al cliente', async () => {
      const { cuentaId, cliente } = await cuentaPagada(admin);
      await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`).expect(200);
      expect((await conexion(cuentaId)).connection_status).toBe('CONECTADA');
      await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`).expect(409);

      const correo = await fuente
        .getRepository(Notification)
        .findOneByOrFail({ recipient: cliente.correo, template: 'cuenta-conectada' });
      expect(correo.payload).toMatchObject({ actualizada: 'no' });

      // Si el cliente cambia la contraseña, vuelve a "por conectar" y se nota que ya estuvo conectada.
      await cliente.web
        .put(`/cuentas/${cuentaId}`, { ...datosCuenta(), contrasenaOperativa: 'otra-operativa-1' })
        .expect(200);
      const listas = await admin.web.get('/admin/cuentas').expect(200);
      const item = listas.body.porConectar.find((c: { id: string }) => c.id === cuentaId);
      expect(item.yaEstuvoConectada).toBe(true);
      expect(new Date(item.desde).getTime()).toBeGreaterThan(Date.now() - 60_000);
    });

    it('al vencer la gracia pasa a por desconectar; marcarla la deja desconectada', async () => {
      const { cuentaId } = await cuentaPagada(admin);
      await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`).expect(200);
      await vencer(cuentaId);
      expect((await conexion(cuentaId)).connection_status).toBe('POR_DESCONECTAR');

      const listas = await admin.web.get('/admin/cuentas').expect(200);
      const item = listas.body.porDesconectar.find((c: { id: string }) => c.id === cuentaId);
      expect(item.licencia.estado).toBe('VENCIDA');

      await admin.web.post(`/admin/cuentas/${cuentaId}/desconectada`).expect(200);
      expect((await conexion(cuentaId)).connection_status).toBe('DESCONECTADA');
    });

    it('capital y riesgo los ve el cliente; las notas, solo los admins', async () => {
      const { cuentaId, cliente } = await cuentaPagada(admin);
      await admin.web
        .put(`/admin/cuentas/${cuentaId}/asignacion`, {
          capitalUsdCentavos: 150_000,
          riesgo: 'MEDIO',
          notas: 'Prefiere Telegram en la tarde.',
        })
        .expect(200);
      const propia = await cliente.web.get(`/cuentas/${cuentaId}`).expect(200);
      expect(propia.body).toMatchObject({
        capitalRecomendadoUsdCentavos: 150_000,
        riesgo: 'MEDIO',
      });
      expect(JSON.stringify(propia.body)).not.toContain('Telegram en la tarde');

      const datos = await admin.web
        .put(`/admin/cuentas/${cuentaId}/asignacion`, { riesgo: 'MUCHO' })
        .expect(400);
      expect(datos.body.campos.riesgo).toBeDefined();

      const auditoria = await fuente.getRepository(AuditLog).findOneByOrFail({
        action: 'cuenta.asignacion',
        targetId: cuentaId,
      });
      expect(auditoria.metadata).toMatchObject({ notasCambiaron: true });
      expect(JSON.stringify(auditoria.metadata)).not.toContain('Telegram');
    });
  });

  describe('licencias', () => {
    it('filtra, busca y cuenta', async () => {
      const { numero, licenciaId } = await cuentaPagada(admin);
      const lista = await admin.web.get(`/admin/licencias?q=${numero}`).expect(200);
      expect(lista.body.licencias).toHaveLength(1);
      expect(lista.body.licencias[0]).toMatchObject({
        id: licenciaId,
        estado: 'ACTIVA',
        plan: 'Mensual',
        cuenta: { numero, conexion: 'POR_CONECTAR' },
      });
      expect(lista.body.conteos).toMatchObject({ todas: 1, activas: 1, vencidas: 0 });

      const vencidas = await admin.web
        .get(`/admin/licencias?filtro=vencidas&q=${numero}`)
        .expect(200);
      expect(vencidas.body.licencias).toHaveLength(0);
      await admin.web.get('/admin/licencias?filtro=otra').expect(400);
      // Los comodines de la búsqueda se toman como texto.
      const comodin = await admin.web.get('/admin/licencias?q=%25').expect(200);
      expect(comodin.body.licencias).toHaveLength(0);
    });

    it('exportar a CSV pide el segundo factor y no lleva contraseñas ni cédulas', async () => {
      const { numero } = await cuentaPagada(admin);
      const otro = await adminConSesion(app);
      await otro.web.get(`/admin/licencias.csv?q=${numero}`).expect(403);
      await otro.confirmar();
      const csv = await otro.web.get(`/admin/licencias.csv?q=${numero}`).expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      const lineas = csv.text.replace('﻿', '').trim().split('\r\n');
      expect(lineas).toHaveLength(2);
      expect(lineas[0]).toContain('Cuenta;Broker;Servidor;Cliente');
      expect(lineas[1]).toContain(`${numero};JustMarkets;JustMarkets-Live;Laura Gómez Restrepo`);
      expect(csv.text).not.toContain('secreta');
      await fuente
        .getRepository(AuditLog)
        .findOneByOrFail({ action: 'licencias.exportadas', actorId: otro.usuario.id });
    });

    it('la ficha trae al cliente con la cédula enmascarada; verla completa queda en la auditoría', async () => {
      const { licenciaId, cliente, orden } = await cuentaPagada(admin);
      const ficha = await admin.web.get(`/admin/licencias/${licenciaId}`).expect(200);
      expect(ficha.body).toMatchObject({
        estado: 'ACTIVA',
        cliente: { id: cliente.usuario.id, correo: cliente.correo },
        periodos: [{ tipo: 'NUEVA', plan: 'Mensual', orden }],
        pagos: [{ numero: orden, estado: 'APROBADA' }],
      });
      expect(ficha.body.cliente.cedulaFinal).toHaveLength(4);
      expect(JSON.stringify(ficha.body)).not.toContain('secreta');

      const cedula = await admin.web
        .post(`/admin/clientes/${cliente.usuario.id}/cedula`)
        .expect(200);
      expect(cedula.body.cedula).toMatch(new RegExp(`${ficha.body.cliente.cedulaFinal}$`));
      await fuente.getRepository(AuditLog).findOneByOrFail({
        action: 'cliente.ver_cedula',
        targetId: cliente.usuario.id,
      });
      await admin.web.get('/admin/licencias/no-es-un-id').expect(400);
    });

    it('extender suma días al vencimiento, con su motivo y un correo al cliente', async () => {
      const { licenciaId, cuentaId, cliente } = await cuentaPagada(admin);
      const antes = await conexion(cuentaId);
      const r = await admin.web
        .post(`/admin/licencias/${licenciaId}/extender`, {
          dias: 10,
          motivo: 'Compensación por la caída del 14 de octubre',
        })
        .expect(200);
      const despues = await conexion(cuentaId);
      expect(despues.ends_at.getTime() - antes.ends_at.getTime()).toBe(10 * 86_400_000);
      expect(new Date(r.body.vence).getTime()).toBe(despues.ends_at.getTime());
      expect(despues.grace_ends_at.getTime() - despues.ends_at.getTime()).toBe(3 * 86_400_000);

      const ficha = await admin.web.get(`/admin/licencias/${licenciaId}`).expect(200);
      expect(ficha.body.periodos[0]).toMatchObject({
        tipo: 'EXTENSION_ADMIN',
        nota: 'Compensación por la caída del 14 de octubre',
        creadoPor: 'Admin de pruebas',
        orden: null,
      });
      const correo = await fuente
        .getRepository(Notification)
        .findOneByOrFail({ recipient: cliente.correo, template: 'licencia-extendida' });
      expect(correo.payload).toMatchObject({ dias: '10 días' });

      await admin.web
        .post(`/admin/licencias/${licenciaId}/extender`, { dias: 200, motivo: 'Demasiado' })
        .expect(400);
      await admin.web.post(`/admin/licencias/${licenciaId}/extender`, { dias: 5 }).expect(400);
    });

    it('extender una vencida cuenta desde hoy y la vuelve a poner por conectar', async () => {
      const { licenciaId, cuentaId } = await cuentaPagada(admin);
      await vencer(cuentaId, 20);
      expect(await conexion(cuentaId)).toMatchObject({
        status: 'VENCIDA',
        connection_status: 'SIN_LICENCIA',
      });
      await admin.web
        .post(`/admin/licencias/${licenciaId}/extender`, { dias: 7, motivo: 'Cortesía comercial' })
        .expect(200);
      const despues = await conexion(cuentaId);
      expect(despues).toMatchObject({ status: 'ACTIVA', connection_status: 'POR_CONECTAR' });
      const dias = (despues.ends_at.getTime() - Date.now()) / 86_400_000;
      expect(dias).toBeGreaterThan(6.9);
      expect(dias).toBeLessThan(7.1);
    });

    it('una licencia sin pagar no se extiende', async () => {
      const cliente = await clienteConSesion(app);
      const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);
      const [licencia] = (await fuente.query(
        `SELECT id FROM licenses WHERE trading_account_id = $1`,
        [cuenta.body.id],
      )) as { id: string }[];
      const r = await admin.web
        .post(`/admin/licencias/${licencia!.id}/extender`, { dias: 5, motivo: 'Por probar' })
        .expect(409);
      expect(r.body.codigo).toBe('NO_EXTENSIBLE');
    });

    it('suspender la saca del copy trading; reactivar la devuelve', async () => {
      const { licenciaId, cuentaId, cliente } = await cuentaPagada(admin);
      await admin.web.post(`/admin/cuentas/${cuentaId}/conectada`).expect(200);

      await admin.web.post(`/admin/licencias/${licenciaId}/suspender`, { motivo: 'x' }).expect(400);
      await admin.web
        .post(`/admin/licencias/${licenciaId}/suspender`, { motivo: 'Uso indebido de la cuenta' })
        .expect(200);
      expect(await conexion(cuentaId)).toMatchObject({
        status: 'SUSPENDIDA',
        connection_status: 'POR_DESCONECTAR',
      });
      // El cliente no puede pagar mientras está suspendida.
      const orden = await cliente.web
        .post('/ordenes', { cuentaId, plan: 'MENSUAL', moneda: 'USDT' })
        .expect(409);
      expect(orden.body.codigo).toBe('LICENCIA_SUSPENDIDA');
      await admin.web
        .post(`/admin/licencias/${licenciaId}/suspender`, { motivo: 'Otra vez' })
        .expect(409);

      await admin.web.post(`/admin/licencias/${licenciaId}/reactivar`).expect(200);
      expect(await conexion(cuentaId)).toMatchObject({
        status: 'ACTIVA',
        connection_status: 'CONECTADA',
      });
      await admin.web.post(`/admin/licencias/${licenciaId}/reactivar`).expect(409);
    });
  });

  describe('ajustes', () => {
    it('cambiar precios pide el segundo factor y solo afecta las órdenes nuevas', async () => {
      const otro = await adminConSesion(app);
      const actuales = await otro.web.get('/admin/ajustes').expect(200);
      const precios = Object.fromEntries(
        actuales.body.planes.map((p: { codigo: string; precioUsdCentavos: number }) => [
          p.codigo,
          p.precioUsdCentavos,
        ]),
      );
      expect(precios).toEqual({ MENSUAL: 12_000, SEMESTRAL: 49_900 });

      const cuerpo = { ...precios, MENSUAL: 13_000 };
      await otro.web.put('/admin/ajustes/precios', cuerpo).expect(403);
      await otro.confirmar();
      await otro.web.put('/admin/ajustes/precios', cuerpo).expect(200);
      const landing = await otro.web.get('/publico/landing').expect(200);
      expect(
        landing.body.planes.find((p: { codigo: string }) => p.codigo === 'MENSUAL')
          .precioUsdCentavos,
      ).toBe(13_000);

      await otro.web.put('/admin/ajustes/precios', precios).expect(200);
      // El primer cambio (el segundo los devuelve a como estaban).
      const auditoria = await fuente.getRepository(AuditLog).findOneOrFail({
        where: { action: 'ajustes.precios', actorId: otro.usuario.id },
        order: { id: 'ASC' },
      });
      expect(auditoria.metadata).toMatchObject({
        antes: { MENSUAL: 12_000 },
        despues: { MENSUAL: 13_000 },
      });
    });

    it('días de gracia, vigencia y confirmaciones', async () => {
      const otro = await adminConSesion(app);
      await otro.confirmar();
      await otro.web
        .put('/admin/ajustes/operacion', {
          diasGracia: 40,
          minutosOrden: 60,
          confirmacionesTron: 20,
          confirmacionesBitcoin: 2,
        })
        .expect(400);
      await otro.web
        .put('/admin/ajustes/operacion', {
          diasGracia: 5,
          minutosOrden: 90,
          confirmacionesTron: 25,
          confirmacionesBitcoin: 3,
        })
        .expect(200);
      const leidos = await otro.web.get('/admin/ajustes').expect(200);
      expect(leidos.body).toMatchObject({
        diasGracia: 5,
        minutosOrden: 90,
        confirmaciones: { TRON: 25, BITCOIN: 3 },
      });
      await otro.web
        .put('/admin/ajustes/operacion', {
          diasGracia: 3,
          minutosOrden: 60,
          confirmacionesTron: 20,
          confirmacionesBitcoin: 2,
        })
        .expect(200);
    });

    it('enlaces y cifras de Myfxbook, con validación', async () => {
      const enlaces = {
        telegram: 'https://t.me/+cdmWH_xLubdhMDhh',
        instagram: 'https://www.instagram.com/doctraderproiasystem/',
        brokerNombre: 'JustMarkets',
        brokerUrl: 'https://one.justmarkets.link/a/5vmbn05zda',
        correoSoporte: 'support@doctraderpro.com',
      };
      const malo = await admin.web
        .put('/admin/ajustes/enlaces', { ...enlaces, telegram: 'http://t.me/x' })
        .expect(400);
      expect(malo.body.campos.telegram).toBeDefined();
      await admin.web.put('/admin/ajustes/enlaces', enlaces).expect(200);

      await admin.web
        .put('/admin/ajustes/myfxbook', {
          url: 'https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459',
          ganancia: '250.10',
          caidaMaxima: null,
          auditadaDesde: null,
          alDia: '2026-10-15',
        })
        .expect(200);
      const landing = await admin.web.get('/publico/landing').expect(200);
      expect(landing.body.myfxbook).toMatchObject({
        accountId: '12253459',
        figures: { gainPercent: '250.10', asOf: '2026-10-15' },
      });
      // Deja las cifras de la semilla para las demás pruebas.
      await admin.web
        .put('/admin/ajustes/myfxbook', {
          url: 'https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459',
          ganancia: '246.68',
          caidaMaxima: null,
          auditadaDesde: null,
          alDia: '2026-10-14',
        })
        .expect(200);
    });
  });

  describe('direcciones de depósito', () => {
    const NUEVA_TRON = 'TKfz7Pu3jtxWrfHzVeozQjXsb3RfuUHGE2';

    // Las demás pruebas usan las direcciones de la semilla.
    afterAll(async () => {
      await fuente.query(
        `UPDATE deposit_addresses SET status = 'CANCELADA' WHERE address = $1 AND status <> 'CANCELADA'`,
        [NUEVA_TRON],
      );
    });

    it('una dirección mal escrita no entra', async () => {
      await admin.confirmar();
      const r = await admin.web
        .post('/admin/direcciones', {
          moneda: 'USDT',
          direccion: 'TKfz7Pu3jtxWrfHzVeozQjXsb3RfuUHGE3',
        })
        .expect(400);
      expect(r.body.campos.direccion).toBeDefined();
      await admin.web
        .post('/admin/direcciones', {
          moneda: 'BTC',
          direccion: 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x',
        })
        .expect(400);
    });

    it('una nueva espera 24 horas, avisa a los admins y se puede cancelar', async () => {
      const otro = await adminConSesion(app);
      await otro.web
        .post('/admin/direcciones', { moneda: 'USDT', direccion: NUEVA_TRON })
        .expect(403);
      await otro.confirmar();
      const nueva = await otro.web
        .post('/admin/direcciones', { moneda: 'USDT', direccion: NUEVA_TRON })
        .expect(201);
      const espera = new Date(nueva.body.activaDesde).getTime() - Date.now();
      expect(espera).toBeGreaterThan(23.9 * 3_600_000);

      const avisos = await fuente
        .getRepository(Notification)
        .findBy({ template: 'direccion-deposito' });
      const destinatarios = avisos.map((a) => a.recipient);
      const admins = (await fuente.query(
        `SELECT email FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
      )) as { email: string }[];
      for (const a of admins) expect(destinatarios).toContain(a.email);
      expect(avisos[0]!.payload).toMatchObject({ direccion: NUEVA_TRON, accion: 'agregada' });

      // La misma dirección no entra dos veces.
      await otro.web
        .post('/admin/direcciones', { moneda: 'USDT', direccion: NUEVA_TRON })
        .expect(409);

      // Mientras espera, las órdenes siguen usando la anterior.
      const { direccion } = await cuentaPagada(admin);
      expect(direccion).not.toBe(NUEVA_TRON);

      // Cancelar no pide el segundo factor: es la salida de emergencia.
      await admin.web.post(`/admin/direcciones/${nueva.body.id}/cancelar`).expect(200);
      const ajustes = await admin.web.get('/admin/ajustes').expect(200);
      expect(
        ajustes.body.direcciones.find((d: { id: string }) => d.id === nueva.body.id).estado,
      ).toBe('CANCELADA');
    });

    it('al cumplir las 24 horas se activa y las órdenes nuevas la usan', async () => {
      await admin.confirmar();
      const nueva = await admin.web
        .post('/admin/direcciones', { moneda: 'USDT', direccion: NUEVA_TRON })
        .expect(201);
      await fuente.query(`UPDATE deposit_addresses SET activates_at = now() WHERE id = $1`, [
        nueva.body.id,
      ]);
      expect(await app.get(AjustesAdminService).activarDirecciones()).toBe(1);
      const { direccion } = await cuentaPagada(admin);
      expect(direccion).toBe(NUEVA_TRON);

      const ajustes = await admin.web.get('/admin/ajustes').expect(200);
      const enUso = ajustes.body.direcciones.filter(
        (d: { red: string; enUso: boolean }) => d.red === 'TRON' && d.enUso,
      );
      expect(enUso.map((d: { direccion: string }) => d.direccion)).toEqual([NUEVA_TRON]);

      // Desactivarla vuelve a la anterior; desactivar pide el segundo factor.
      const otro = await adminConSesion(app);
      await otro.web.post(`/admin/direcciones/${nueva.body.id}/desactivar`).expect(403);
      await otro.confirmar();
      await otro.web.post(`/admin/direcciones/${nueva.body.id}/desactivar`).expect(200);
      const despues = await cuentaPagada(admin);
      expect(despues.direccion).toBe('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x');
    });
  });

  describe('hoy', () => {
    it('cuenta lo pendiente, las ventas del mes y la actividad', async () => {
      const antes = await admin.web.get('/admin/resumen').expect(200);
      const { numero } = await cuentaPagada(admin, 'SEMESTRAL');
      const despues = await admin.web.get('/admin/resumen').expect(200);
      expect(despues.body.pendientes.porConectar).toBe(antes.body.pendientes.porConectar + 1);
      expect(despues.body.ventas.mes.usdCentavos).toBe(antes.body.ventas.mes.usdCentavos + 49_900);
      expect(despues.body.ventas.mes.licencias).toBe(antes.body.ventas.mes.licencias + 1);
      expect(despues.body.cuentas.nuevasMes).toBe(antes.body.cuentas.nuevasMes + 1);
      const hoy = despues.body.ventas.porDia.filter(
        (d: { dia: number; plan: string }) =>
          d.dia === despues.body.ventas.calendario.hoy && d.plan === 'SEMESTRAL',
      );
      expect(hoy[0].n).toBeGreaterThanOrEqual(1);
      expect(despues.body.actividad[0].texto).toMatch(/aprobó el pago DTP-/);
      expect(numero).toBeDefined();
    });
  });
});
