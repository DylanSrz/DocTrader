import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { AvisosEnvio } from '../src/avisos/avisos-envio.js';
import { CONTEXTO_SECRETO_AVISO } from '../src/avisos/avisos.service.js';
import { Consent, Notification, User } from '../src/database/entidades/index.js';
import { REDIS } from '../src/redis/redis.module.js';
import { adminConSesion } from './ayudas.js';
import { CifradoService } from '../src/seguridad/cifrado.service.js';
import { comoLaWeb, crearApp, ipAleatoria } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
let redis: Redis;
let cifrado: CifradoService;

beforeAll(async () => {
  app = await crearApp();
  fuente = app.get(getDataSourceToken());
  redis = app.get(REDIS);
  cifrado = app.get(CifradoService);
});

afterAll(async () => {
  await app.close();
});

/** El último correo en la bandeja de salida para alguien, con su enlace de un solo uso descifrado. */
async function ultimoCorreo(correo: string, plantilla: string) {
  const aviso = await fuente.getRepository(Notification).findOne({
    where: { recipient: correo, template: plantilla },
    order: { createdAt: 'DESC' },
  });
  return {
    aviso,
    secreto: aviso?.secretEnc ? cifrado.descifrar(aviso.secretEnc, CONTEXTO_SECRETO_AVISO) : null,
  };
}

function codigoDeLaApp(secreto: string): string {
  return new TOTP({ secret: Secret.fromBase32(secreto) }).generate();
}

/** Los códigos de la app no se aceptan dos veces en el mismo medio minuto; entre pasos de la prueba se olvida. */
async function olvidarCodigosUsados() {
  const claves = await redis.keys('totp:usado:*');
  if (claves.length > 0) await redis.del(...claves);
}

let consecutivo = 0;
function datosDeRegistro(cambios: Record<string, unknown> = {}) {
  consecutivo += 1;
  return {
    nombre: 'Ana María Pérez',
    cedula: `1.040.${String(100_000 + consecutivo).slice(-3)}.${String(consecutivo).padStart(3, '0')}`,
    correo: `ana.perez${consecutivo}@correo.co`,
    telefono: `300 ${String(1_000_000 + consecutivo * 7).slice(-7)}`,
    contrasena: 'Una contraseña bien larga 7!',
    aceptaTerminos: true,
    aceptaDatos: true,
    aceptaRiesgo: true,
    ...cambios,
  };
}

/** Registra un cliente, confirma su correo e ingresa. Devuelve el token de su sesión. */
async function clienteConSesion(dispositivo = 'navegador-de-pruebas-0001') {
  const datos = datosDeRegistro();
  await comoLaWeb(app).post('/auth/registro', datos).expect(202);
  const { secreto } = await ultimoCorreo(datos.correo, 'verificar-correo');
  await comoLaWeb(app).post('/auth/verificar-correo', { token: secreto }).expect(200);
  const ingreso = await comoLaWeb(app)
    .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena, dispositivo })
    .expect(200);
  return { datos, token: ingreso.body.token as string };
}

describe('solo la web habla con la API', () => {
  it('sin el secreto de la web, la API responde 404', async () => {
    await request(app.getHttpServer()).post('/auth/ingresar').send({}).expect(404);
    await request(app.getHttpServer())
      .get('/auth/sesion')
      .set('x-doctrader-proxy', 'otro-secreto-que-no-es-el-de-la-web-000')
      .expect(404);
  });

  it('/salud queda abierta para el monitor', async () => {
    await request(app.getHttpServer()).get('/salud').expect(200);
  });
});

describe('registro', () => {
  it('rechaza datos inválidos con mensajes en español por campo', async () => {
    const respuesta = await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({ cedula: '12#45', contrasena: 'corta', aceptaRiesgo: false }),
      )
      .expect(400);
    expect(respuesta.body.codigo).toBe('DATOS_INVALIDOS');
    expect(respuesta.body.campos.contrasena).toMatch(/entre 10 y 128/);
    expect(respuesta.body.campos.aceptaRiesgo).toMatch(/aviso de riesgo/);
  });

  it('exige mayúscula, minúscula, número y carácter especial en la contraseña', async () => {
    const casos: [string, RegExp][] = [
      ['UNA CONTRASEÑA LARGA 7!', /una letra minúscula/],
      ['una contraseña larga 7!', /una letra mayúscula/],
      ['Una contraseña larga!', /un número/],
      ['Una contraseña larga 7', /un carácter especial/],
    ];
    for (const [contrasena, falta] of casos) {
      const respuesta = await comoLaWeb(app)
        .post('/auth/registro', datosDeRegistro({ contrasena }))
        .expect(400);
      expect(respuesta.body.campos.contrasena).toMatch(falta);
    }
  });

  it('el nombre solo lleva letras: nada de dominios ni enlaces que lleguen en los correos', async () => {
    for (const nombre of ['doctrader-pagos.com', 'Ana <b>', 'Pedro 123']) {
      const respuesta = await comoLaWeb(app)
        .post('/auth/registro', datosDeRegistro({ nombre }))
        .expect(400);
      expect(respuesta.body.campos.nombre).toMatch(/solo con letras/);
    }
    await comoLaWeb(app)
      .post('/auth/registro', datosDeRegistro({ nombre: "María José O'Neill-Peña" }))
      .expect(202);
  });

  it('rechaza campos que no existen', async () => {
    const respuesta = await comoLaWeb(app)
      .post('/auth/registro', datosDeRegistro({ role: 'ADMIN' }))
      .expect(400);
    expect(respuesta.body.campos.role).toBeDefined();
  });

  it('crea la cuenta con la cédula cifrada, las autorizaciones y el correo de verificación', async () => {
    const datos = datosDeRegistro({ aceptaMercadeo: true });
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);

    const usuario = await fuente.getRepository(User).findOneByOrFail({ email: datos.correo });
    expect(usuario.role).toBe('CLIENT');
    expect(usuario.phoneE164).toMatch(/^\+57300\d{7}$/);
    expect(usuario.emailVerifiedAt).toBeNull();
    expect(usuario.passwordHash).toMatch(/^\$argon2id\$/);
    const cedula = datos.cedula.replaceAll('.', '');
    expect(usuario.cedulaEnc!.toString('latin1')).not.toContain(cedula);
    expect(cifrado.descifrar(usuario.cedulaEnc!, 'users.cedula')).toBe(cedula);
    expect(usuario.cedulaLast4).toBe(cedula.slice(-4));

    const autorizaciones = await fuente.getRepository(Consent).findBy({ userId: usuario.id });
    expect(autorizaciones.map((a) => a.type).sort()).toEqual([
      'MARKETING',
      'PRIVACY',
      'RISK',
      'TERMS',
    ]);
    const terminos = autorizaciones.find((a) => a.type === 'TERMS')!;
    // Apunta al texto vigente (otras pruebas pueden haber publicado versiones nuevas).
    const [vigente] = (await fuente.query(
      `SELECT id, version FROM legal_documents WHERE type = 'TERMS' ORDER BY version DESC LIMIT 1`,
    )) as { id: string; version: number }[];
    expect(terminos.legalDocumentId).toBe(vigente!.id);
    expect(terminos.documentVersion).toBe(String(vigente!.version));

    const { aviso, secreto } = await ultimoCorreo(datos.correo, 'verificar-correo');
    expect(aviso!.status).toBe('PENDIENTE');
    expect(secreto).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(aviso!.payload)).not.toContain(secreto!);
  });

  it('con un correo ya registrado responde igual, no crea otra cuenta y avisa al dueño', async () => {
    const datos = datosDeRegistro({ correo: 'pedro.gomez@gmail.com' });
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);
    const otro = datosDeRegistro({ correo: 'Pedro.Gomez+otra@gmail.com' });
    const respuesta = await comoLaWeb(app).post('/auth/registro', otro).expect(202);
    expect(respuesta.body).toEqual({ ok: true });
    expect(
      await fuente.getRepository(User).countBy({ emailCanonical: 'pedrogomez@gmail.com' }),
    ).toBe(1);
    expect((await ultimoCorreo('pedro.gomez@gmail.com', 'ya-registrado')).aviso).not.toBeNull();
  });

  it('registra el país, el tipo y el número del documento por separado, también de otros países', async () => {
    const numero = `5${String(10_000_000 + consecutivo).slice(-8)}`;
    const pasaporte = datosDeRegistro({
      cedula: undefined,
      documentoPais: 'GB',
      documentoTipo: 'PA',
      documento: numero,
    });
    await comoLaWeb(app).post('/auth/registro', pasaporte).expect(202);
    const [usuario] = (await fuente.query(
      `SELECT document_country, document_type, cedula_last4 FROM users WHERE email = $1`,
      [pasaporte.correo],
    )) as Record<string, string>[];
    expect(usuario).toEqual({
      document_country: 'GB',
      document_type: 'PA',
      cedula_last4: numero.slice(-4),
    });

    // El mismo número en otro país o tipo es otra persona; en el mismo país y tipo, no.
    await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({
          cedula: undefined,
          documentoPais: 'US',
          documentoTipo: 'PA',
          documento: numero,
        }),
      )
      .expect(202);
    const repetido = await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({
          cedula: undefined,
          documentoPais: 'GB',
          documentoTipo: 'PA',
          documento: numero,
        }),
      )
      .expect(409);
    expect(repetido.body.codigo).toBe('DATOS_EN_USO');
  });

  it('valida el número según el tipo de documento y explica cómo corregirlo', async () => {
    const conPuntos = await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({ documentoPais: 'CO', documentoTipo: 'CC', documento: '1.020.304' }),
      )
      .expect(400);
    expect(conPuntos.body.campos.documento).toMatch(/solo números/);
    const sinTipo = await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({ documentoPais: 'CO', documentoTipo: 'TI', documento: '1020304050' }),
      )
      .expect(400);
    expect(sinTipo.body.campos.documentoTipo).toMatch(/tipo de documento/);
    const curp = await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({ documentoPais: 'MX', documentoTipo: 'CURP', documento: 'GORL9001' }),
      )
      .expect(400);
    expect(curp.body.campos.documento).toMatch(/CURP/);
  });

  it('no permite dos cuentas con la misma cédula o el mismo celular', async () => {
    const datos = datosDeRegistro();
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);
    const mismaCedula = await comoLaWeb(app)
      .post('/auth/registro', datosDeRegistro({ cedula: datos.cedula.replaceAll('.', ' ') }))
      .expect(409);
    expect(mismaCedula.body.codigo).toBe('DATOS_EN_USO');
    await comoLaWeb(app)
      .post(
        '/auth/registro',
        datosDeRegistro({ telefono: `+57${datos.telefono.replaceAll(' ', '')}` }),
      )
      .expect(409);
  });

  it('limita los registros por IP', async () => {
    const ip = ipAleatoria();
    for (let i = 0; i < 5; i++) {
      await comoLaWeb(app, { ip }).post('/auth/registro', datosDeRegistro()).expect(202);
    }
    const respuesta = await comoLaWeb(app, { ip })
      .post('/auth/registro', datosDeRegistro())
      .expect(429);
    expect(respuesta.body.codigo).toBe('DEMASIADOS_INTENTOS');
    expect(respuesta.body.reintentarEn).toBeGreaterThan(0);
  });
});

describe('verificación del correo e ingreso', () => {
  it('no deja entrar sin confirmar el correo, pero solo lo dice si la contraseña es correcta', async () => {
    const datos = datosDeRegistro();
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);

    const mala = await comoLaWeb(app)
      .post('/auth/ingresar', { correo: datos.correo, contrasena: 'otra contraseña larga' })
      .expect(401);
    expect(mala.body.codigo).toBe('CREDENCIALES_INVALIDAS');

    const sinVerificar = await comoLaWeb(app)
      .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena })
      .expect(403);
    expect(sinVerificar.body.codigo).toBe('CORREO_SIN_VERIFICAR');
  });

  it('un correo que no existe recibe el mismo error que una contraseña equivocada', async () => {
    const respuesta = await comoLaWeb(app)
      .post('/auth/ingresar', { correo: 'nadie@correo.co', contrasena: 'cualquier cosa larga' })
      .expect(401);
    expect(respuesta.body).toEqual({
      codigo: 'CREDENCIALES_INVALIDAS',
      mensaje: 'El correo o la contraseña no son correctos.',
    });
  });

  it('el enlace de verificación sirve una sola vez', async () => {
    const datos = datosDeRegistro();
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);
    const { secreto } = await ultimoCorreo(datos.correo, 'verificar-correo');
    await comoLaWeb(app).post('/auth/verificar-correo', { token: secreto }).expect(200);
    const otraVez = await comoLaWeb(app)
      .post('/auth/verificar-correo', { token: secreto })
      .expect(400);
    expect(otraVez.body.codigo).toBe('ENLACE_INVALIDO');
  });

  it('reenviar la verificación anula el enlace anterior', async () => {
    const datos = datosDeRegistro();
    await comoLaWeb(app).post('/auth/registro', datos).expect(202);
    const primero = (await ultimoCorreo(datos.correo, 'verificar-correo')).secreto;
    await comoLaWeb(app).post('/auth/reenviar-verificacion', { correo: datos.correo }).expect(202);
    const segundo = (await ultimoCorreo(datos.correo, 'verificar-correo')).secreto;
    expect(segundo).not.toBe(primero);
    await comoLaWeb(app).post('/auth/verificar-correo', { token: primero }).expect(400);
    await comoLaWeb(app).post('/auth/verificar-correo', { token: segundo }).expect(200);
  });

  it('con el correo confirmado entra, ve su sesión y puede salir', async () => {
    const { datos, token } = await clienteConSesion();
    const sesion = await comoLaWeb(app, { token }).get('/auth/sesion').expect(200);
    expect(sesion.body).toMatchObject({
      estado: 'COMPLETA',
      usuario: { nombre: datos.nombre, correo: datos.correo, rol: 'CLIENT', segundoFactor: false },
    });
    expect(sesion.body.usuario).not.toHaveProperty('cedula');

    await comoLaWeb(app, { token }).post('/auth/salir').expect(200);
    const despues = await comoLaWeb(app, { token }).get('/auth/sesion').expect(401);
    expect(despues.body.codigo).toBe('SIN_SESION');
  });

  it('avisa por correo de un ingreso desde un navegador nuevo, no desde uno conocido', async () => {
    const { datos } = await clienteConSesion('navegador-conocido-0001');
    const ingresar = (dispositivo: string) =>
      comoLaWeb(app)
        .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena, dispositivo })
        .expect(200);

    await ingresar('navegador-conocido-0001');
    expect((await ultimoCorreo(datos.correo, 'nuevo-ingreso')).aviso).toBeNull();

    await ingresar('navegador-nuevo-00000001');
    const { aviso } = await ultimoCorreo(datos.correo, 'nuevo-ingreso');
    expect(aviso!.payload.navegador).toBe('Chrome en Windows');
  });

  it('después de 5 contraseñas equivocadas hay que esperar, aunque la sexta sea la correcta', async () => {
    const { datos } = await clienteConSesion();
    const ip = ipAleatoria();
    for (let i = 0; i < 5; i++) {
      await comoLaWeb(app, { ip })
        .post('/auth/ingresar', { correo: datos.correo, contrasena: `equivocada número ${i}` })
        .expect(401);
    }
    const respuesta = await comoLaWeb(app, { ip })
      .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena })
      .expect(429);
    expect(respuesta.body.reintentarEn).toBeGreaterThan(0);
    // La espera es de esa IP: el dueño, desde la suya, sigue entrando.
    await comoLaWeb(app)
      .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena })
      .expect(200);
  });

  it('al llegar a 10 fallos avisa al dueño de la cuenta', async () => {
    const { datos } = await clienteConSesion();
    for (let i = 0; i < 10; i++) {
      await comoLaWeb(app)
        .post('/auth/ingresar', { correo: datos.correo, contrasena: `equivocada número ${i}` })
        .expect(401);
    }
    expect((await ultimoCorreo(datos.correo, 'intentos-fallidos')).aviso).not.toBeNull();
  });
});

describe('recuperar la contraseña', () => {
  it('responde igual exista o no el correo', async () => {
    const respuesta = await comoLaWeb(app)
      .post('/auth/recuperar', { correo: 'no-existe@correo.co' })
      .expect(202);
    expect(respuesta.body).toEqual({ ok: true });
  });

  it('cambia la contraseña con el enlace, cierra las sesiones y el enlace no sirve dos veces', async () => {
    const { datos, token } = await clienteConSesion();
    await comoLaWeb(app).post('/auth/recuperar', { correo: datos.correo }).expect(202);
    const { secreto } = await ultimoCorreo(datos.correo, 'restablecer-contrasena');

    // Una contraseña nueva sin mayúscula, número ni carácter especial no sirve, y el enlace sigue vigente.
    const debil = await comoLaWeb(app)
      .post('/auth/restablecer', { token: secreto, contrasena: 'la nueva contraseña segura' })
      .expect(400);
    expect(debil.body.campos.contrasena).toBe(
      'A la contraseña le falta una letra mayúscula, un número y un carácter especial (por ejemplo ! # $ % & * ?).',
    );
    await comoLaWeb(app)
      .post('/auth/restablecer', { token: secreto, contrasena: 'La nueva contraseña segura 9#' })
      .expect(200);
    await comoLaWeb(app, { token }).get('/auth/sesion').expect(401);
    await comoLaWeb(app)
      .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena })
      .expect(401);
    await comoLaWeb(app)
      .post('/auth/ingresar', { correo: datos.correo, contrasena: 'La nueva contraseña segura 9#' })
      .expect(200);
    await comoLaWeb(app)
      .post('/auth/restablecer', { token: secreto, contrasena: 'otra contraseña más' })
      .expect(400);
    expect((await ultimoCorreo(datos.correo, 'contrasena-cambiada')).aviso).not.toBeNull();
  });
});

describe('admins: segundo factor obligatorio', () => {
  const correoAdmin = 'doctraderproiasystem@gmail.com';
  const contrasenaAdmin = 'Contraseña de admin muy segura 1!';
  let secretoTotp = '';
  let codigosRecuperacion: string[] = [];

  async function ingresarAdmin() {
    const respuesta = await comoLaWeb(app)
      .post('/auth/ingresar', { correo: correoAdmin, contrasena: contrasenaAdmin })
      .expect(200);
    return respuesta.body as { token: string; estado: string };
  }

  it('el admin de la semilla crea su contraseña con el enlace de recuperar', async () => {
    await comoLaWeb(app).post('/auth/recuperar', { correo: correoAdmin }).expect(202);
    const { secreto } = await ultimoCorreo(correoAdmin, 'restablecer-contrasena');
    await comoLaWeb(app)
      .post('/auth/restablecer', { token: secreto, contrasena: contrasenaAdmin })
      .expect(200);
  });

  it('sin segundo factor configurado no puede usar el panel', async () => {
    const { token, estado } = await ingresarAdmin();
    expect(estado).toBe('SEGUNDO_FACTOR_POR_CONFIGURAR');
    const respuesta = await comoLaWeb(app, { token }).get('/admin/resumen').expect(403);
    expect(respuesta.body.codigo).toBe('SEGUNDO_FACTOR_POR_CONFIGURAR');
  });

  it('configura el segundo factor, recibe 10 códigos de recuperación y queda en el panel', async () => {
    const { token } = await ingresarAdmin();
    const configuracion = await comoLaWeb(app, { token })
      .post('/auth/segundo-factor/configurar')
      .expect(200);
    expect(configuracion.body.qr).toMatch(/^data:image\/png;base64,/);
    secretoTotp = configuracion.body.secreto;

    await comoLaWeb(app, { token })
      .post('/auth/segundo-factor/activar', { codigo: '000000' })
      .expect(400);
    const activacion = await comoLaWeb(app, { token })
      .post('/auth/segundo-factor/activar', { codigo: codigoDeLaApp(secretoTotp) })
      .expect(200);
    codigosRecuperacion = activacion.body.codigos;
    expect(codigosRecuperacion).toHaveLength(10);
    expect(activacion.body.estado).toBe('COMPLETA');

    // La sesión a medias quedó cerrada; la nueva sí entra al panel.
    await comoLaWeb(app, { token }).get('/auth/sesion').expect(401);
    const resumen = await comoLaWeb(app, { token: activacion.body.token })
      .get('/admin/resumen')
      .expect(200);
    expect(resumen.body.cuentas.clientes).toBeGreaterThan(0);

    const usuario = await fuente.getRepository(User).findOneByOrFail({ email: correoAdmin });
    expect(usuario.totpSecretEnc!.toString('latin1')).not.toContain(secretoTotp);
  });

  it('al ingresar pide el código; la sesión a medias no sirve para nada más', async () => {
    await olvidarCodigosUsados();
    const { token, estado } = await ingresarAdmin();
    expect(estado).toBe('SEGUNDO_FACTOR_PENDIENTE');
    await comoLaWeb(app, { token }).get('/admin/resumen').expect(403);
    await comoLaWeb(app, { token }).post('/auth/segundo-factor/configurar').expect(403);

    await comoLaWeb(app, { token }).post('/auth/segundo-factor', { codigo: '123456' }).expect(400);
    const codigo = codigoDeLaApp(secretoTotp);
    const completo = await comoLaWeb(app, { token })
      .post('/auth/segundo-factor', { codigo })
      .expect(200);
    expect(completo.body.estado).toBe('COMPLETA');
    expect(completo.body.token).not.toBe(token);
    await comoLaWeb(app, { token }).get('/auth/sesion').expect(401);
    await comoLaWeb(app, { token: completo.body.token }).get('/admin/resumen').expect(200);

    // El mismo código no se acepta dos veces.
    const otro = await ingresarAdmin();
    await comoLaWeb(app, { token: otro.token })
      .post('/auth/segundo-factor', { codigo })
      .expect(400);
  });

  it('cierra la sesión a medias después de 5 códigos equivocados', async () => {
    const { token } = await ingresarAdmin();
    for (let i = 0; i < 4; i++) {
      await comoLaWeb(app, { token })
        .post('/auth/segundo-factor', { codigo: '000000' })
        .expect(400);
    }
    const ultimo = await comoLaWeb(app, { token })
      .post('/auth/segundo-factor', { codigo: '000000' })
      .expect(401);
    expect(ultimo.body.codigo).toBe('SIN_SESION');
  });

  it('el límite de códigos es por usuario: muchos intentos al mismo tiempo no pasan de 10', async () => {
    const admin = await adminConSesion(app);
    const sesiones = await Promise.all(
      Array.from({ length: 3 }, () =>
        comoLaWeb(app)
          .post('/auth/ingresar', {
            correo: admin.usuario.email,
            contrasena: 'Contraseña de admin de pruebas 1!',
          })
          .expect(200),
      ),
    );
    const respuestas = await Promise.all(
      sesiones.flatMap((s) =>
        Array.from({ length: 10 }, () =>
          comoLaWeb(app, { token: s.body.token as string }).post('/auth/segundo-factor', {
            codigo: '000000',
          }),
        ),
      ),
    );
    // 400 es "código incorrecto": solo esos llegaron a compararse.
    expect(respuestas.filter((r) => r.status === 400).length).toBeLessThanOrEqual(10);
    expect(respuestas.some((r) => r.body.codigo === 'DEMASIADOS_CODIGOS')).toBe(true);
  });

  it('un código de recuperación sirve una sola vez y avisa por correo', async () => {
    const codigo = codigosRecuperacion[0]!.toUpperCase().replace('-', ' ');
    const primero = await ingresarAdmin();
    await comoLaWeb(app, { token: primero.token })
      .post('/auth/segundo-factor', { codigo })
      .expect(200);
    const segundo = await ingresarAdmin();
    await comoLaWeb(app, { token: segundo.token })
      .post('/auth/segundo-factor', { codigo })
      .expect(400);
    const { aviso } = await ultimoCorreo(correoAdmin, 'codigo-recuperacion-usado');
    expect(aviso!.payload.restantes).toBe('9');
  });

  it('regenerar los códigos exige una confirmación reciente', async () => {
    await olvidarCodigosUsados();
    const pendiente = await ingresarAdmin();
    const sesion = await comoLaWeb(app, { token: pendiente.token })
      .post('/auth/segundo-factor', { codigo: codigoDeLaApp(secretoTotp) })
      .expect(200);
    const token = sesion.body.token as string;

    const sinConfirmar = await comoLaWeb(app, { token })
      .post('/auth/segundo-factor/codigos')
      .expect(403);
    expect(sinConfirmar.body.codigo).toBe('CONFIRMACION_REQUERIDA');

    await olvidarCodigosUsados();
    await comoLaWeb(app, { token }).post('/auth/confirmar', { codigo: '999999' }).expect(400);
    await comoLaWeb(app, { token })
      .post('/auth/confirmar', { codigo: codigoDeLaApp(secretoTotp) })
      .expect(200);
    const nuevos = await comoLaWeb(app, { token }).post('/auth/segundo-factor/codigos').expect(200);
    expect(nuevos.body.codigos).toHaveLength(10);
    expect(nuevos.body.codigos).not.toContain(codigosRecuperacion[1]);
  });

  it('la auditoría registra los ingresos de admins y sigue íntegra', async () => {
    const acciones = (await fuente.query(
      `SELECT action FROM audit_log WHERE actor_id = (SELECT id FROM users WHERE email = $1)`,
      [correoAdmin],
    )) as { action: string }[];
    const nombres = acciones.map((a) => a.action);
    expect(nombres).toContain('auth.contrasena_restablecida');
    expect(nombres).toContain('auth.segundo_factor_activado');
    expect(nombres).toContain('auth.ingreso');
    expect(nombres).toContain('auth.codigo_recuperacion_usado');
    expect(nombres).toContain('auth.codigos_regenerados');
    expect(await app.get(AuditoriaService).verificar()).toEqual({ valida: true });
  });
});

describe('permisos', () => {
  it('sin sesión no se entra a nada que no sea público', async () => {
    const respuesta = await comoLaWeb(app).get('/auth/sesion').expect(401);
    expect(respuesta.body.codigo).toBe('SIN_SESION');
    await comoLaWeb(app).get('/admin/resumen').expect(401);
    await comoLaWeb(app, { token: 'token-inventado' }).get('/admin/resumen').expect(401);
  });

  it('un cliente no entra a las rutas de admin', async () => {
    const { token } = await clienteConSesion();
    const respuesta = await comoLaWeb(app, { token }).get('/admin/resumen').expect(403);
    expect(respuesta.body.codigo).toBe('SIN_PERMISO');
  });

  it('si la cuenta se suspende o se borra, su sesión deja de servir al instante', async () => {
    const { datos, token } = await clienteConSesion();
    await fuente.query(`UPDATE users SET status = 'SUSPENDED' WHERE email = $1`, [datos.correo]);
    const respuesta = await comoLaWeb(app, { token }).get('/auth/sesion').expect(401);
    expect(respuesta.body.codigo).toBe('SIN_SESION');
  });

  it('un cliente sin segundo factor confirma con su contraseña', async () => {
    const { datos, token } = await clienteConSesion();
    await comoLaWeb(app, { token })
      .post('/auth/confirmar', { contrasena: 'no es esta' })
      .expect(400);
    const confirmado = await comoLaWeb(app, { token })
      .post('/auth/confirmar', { contrasena: datos.contrasena })
      .expect(200);
    expect(confirmado.body.confirmadaHasta).toBeGreaterThan(Date.now());
  });
});

describe('sesiones abiertas', () => {
  it('cada usuario ve sus sesiones y puede cerrar las demás', async () => {
    const { datos, token } = await clienteConSesion();
    const otra = await comoLaWeb(app, {
      agente: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1',
    })
      .post('/auth/ingresar', { correo: datos.correo, contrasena: datos.contrasena })
      .expect(200);

    const lista = await comoLaWeb(app, { token }).get('/auth/sesiones').expect(200);
    expect(lista.body).toHaveLength(2);
    expect(lista.body.filter((s: { actual: boolean }) => s.actual)).toHaveLength(1);
    expect(JSON.stringify(lista.body)).not.toContain(token);

    await comoLaWeb(app, { token }).post('/auth/sesiones/cerrar-otras').expect(200);
    await comoLaWeb(app, { token: otra.body.token }).get('/auth/sesion').expect(401);
    await comoLaWeb(app, { token }).get('/auth/sesion').expect(200);
  });

  it('nadie puede cerrar la sesión de otro usuario con su id', async () => {
    const ana = await clienteConSesion();
    const beto = await clienteConSesion();
    const [sesionDeBeto] = (await comoLaWeb(app, { token: beto.token }).get('/auth/sesiones')).body;
    await comoLaWeb(app, { token: ana.token })
      .delete(`/auth/sesiones/${sesionDeBeto.id}`)
      .expect(404);
    await comoLaWeb(app, { token: beto.token }).get('/auth/sesion').expect(200);
  });
});

describe('envío de correos (worker)', () => {
  it('envía los pendientes y borra el enlace cifrado de la bandeja', async () => {
    const envio = new AvisosEnvio(fuente, cifrado, app.get(ConfigService));
    let enviados = 0;
    for (
      let lote = await envio.enviarPendientes();
      lote > 0;
      lote = await envio.enviarPendientes()
    ) {
      enviados += lote;
    }
    expect(enviados).toBeGreaterThan(0);
    const pendientes = await fuente.getRepository(Notification).countBy({ status: 'PENDIENTE' });
    expect(pendientes).toBe(0);
    const conSecreto = await fuente.query(
      `SELECT count(*)::int AS n FROM notifications WHERE secret_enc IS NOT NULL`,
    );
    expect(conSecreto[0].n).toBe(0);
  });
});
