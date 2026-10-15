import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { Secret, TOTP } from 'otpauth';
import type { DataSource } from 'typeorm';
import { Consent, User } from '../src/database/entidades/index.js';
import { REDIS } from '../src/redis/redis.module.js';
import { CifradoService } from '../src/seguridad/cifrado.service.js';
import { ContrasenasService } from '../src/seguridad/contrasenas.service.js';
import { CONTEXTO_SECRETO_AVISO } from '../src/avisos/avisos.service.js';
import { Notification } from '../src/database/entidades/index.js';
import { comoLaWeb, crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;
let redis: Redis;

beforeAll(async () => {
  app = await crearApp();
  fuente = app.get(getDataSourceToken());
  redis = app.get(REDIS);
});

afterAll(async () => {
  await app.close();
});

const SECRETO_TOTP = new Secret({ size: 20 }).base32;
const codigo = () => new TOTP({ secret: Secret.fromBase32(SECRETO_TOTP) }).generate();

async function olvidarCodigosUsados() {
  const claves = await redis.keys('totp:usado:*');
  if (claves.length > 0) await redis.del(...claves);
}

/** Un admin con contraseña y segundo factor, ya dentro. Devuelve el token de su sesión completa. */
async function adminConSesion(): Promise<string> {
  const correo = `admin.contenido.${Date.now()}@doctraderpro.com`;
  const contrasena = 'contraseña de admin de pruebas';
  await fuente.getRepository(User).insert({
    role: 'ADMIN',
    fullName: 'Admin de pruebas',
    email: correo,
    emailCanonical: correo,
    emailVerifiedAt: new Date(),
    passwordHash: await app.get(ContrasenasService).crearHash(contrasena),
    totpSecretEnc: app.get(CifradoService).cifrar(SECRETO_TOTP, 'users.totp'),
    totpEnabledAt: new Date(),
  });
  const ingreso = await comoLaWeb(app).post('/auth/ingresar', { correo, contrasena }).expect(200);
  await olvidarCodigosUsados();
  const completo = await comoLaWeb(app, { token: ingreso.body.token })
    .post('/auth/segundo-factor', { codigo: codigo() })
    .expect(200);
  return completo.body.token as string;
}

async function confirmar(token: string) {
  await olvidarCodigosUsados();
  await comoLaWeb(app, { token }).post('/auth/confirmar', { codigo: codigo() }).expect(200);
}

describe('página pública', () => {
  it('da los planes y precios de la base de datos, las preguntas, las cifras y los enlaces', async () => {
    const respuesta = await comoLaWeb(app).get('/publico/landing').expect(200);
    const { planes, preguntas, myfxbook, enlaces, correoSoporte } = respuesta.body;
    expect(planes.map((p: { codigo: string }) => p.codigo)).toEqual(['MENSUAL', 'SEMESTRAL']);
    expect(planes.find((p: { codigo: string }) => p.codigo === 'SEMESTRAL')).toMatchObject({
      precioUsdCentavos: 49_900,
      meses: 6,
      mesesObsequio: 0,
      dolaresPorMes: 83,
      publico: true,
    });
    expect(preguntas).toHaveLength(8);
    expect(myfxbook.figures.gainPercent).toBe('246.68');
    expect(enlaces.broker.name).toBe('JustMarkets');
    expect(correoSoporte).toBe('support@doctraderpro.com');
  });

  it('da el texto legal vigente sin el título ni la nota interna del borrador', async () => {
    const respuesta = await comoLaWeb(app).get('/publico/legal/riesgo').expect(200);
    expect(respuesta.body).toMatchObject({ tipo: 'RISK', version: 1 });
    expect(respuesta.body.contenido).not.toMatch(/^# /);
    expect(respuesta.body.contenido).not.toContain('conviene que lo revise un abogado');
    expect(respuesta.body.contenido).toContain('Puedes perder dinero');
    // Lo que va después de la línea final del borrador es interno (la versión corta del aviso).
    expect(respuesta.body.contenido).not.toContain('Versión corta');
    await comoLaWeb(app).get('/publico/legal/otra-cosa').expect(404);
  });
});

describe('textos legales desde el panel', () => {
  let token: string;

  beforeAll(async () => {
    token = await adminConSesion();
  });

  it('un cliente o alguien sin sesión no puede verlos ni publicarlos', async () => {
    await comoLaWeb(app).get('/admin/legal').expect(401);
    await comoLaWeb(app)
      .post('/admin/legal/TERMS', { contenido: 'x'.repeat(60) })
      .expect(401);
  });

  it('publicar una versión nueva exige confirmar con el segundo factor', async () => {
    const respuesta = await comoLaWeb(app, { token })
      .post('/admin/legal/TERMS', { contenido: 'Términos nuevos. '.repeat(10) })
      .expect(403);
    expect(respuesta.body.codigo).toBe('CONFIRMACION_REQUERIDA');
  });

  it('publica una versión nueva, la página pública la muestra y los registros nuevos la aceptan', async () => {
    // Otras pruebas pueden haber publicado versiones antes: se cuenta desde la vigente.
    const anterior = (await comoLaWeb(app).get('/publico/legal/terminos').expect(200)).body
      .version as number;
    const versiones = async () =>
      (await comoLaWeb(app, { token }).get('/admin/legal').expect(200)).body.map(
        (d: { version: number }) => d.version,
      ) as number[];
    const [, ...otrosAntes] = await versiones();
    await confirmar(token);
    const texto =
      '## 1. Quiénes somos\n\nTérminos nuevos de la licencia, versión de prueba. '.repeat(3);
    const publicada = await comoLaWeb(app, { token })
      .post('/admin/legal/TERMS', { contenido: texto })
      .expect(201);
    expect(publicada.body.version).toBe(anterior + 1);

    const publica = await comoLaWeb(app).get('/publico/legal/terminos').expect(200);
    expect(publica.body.version).toBe(anterior + 1);

    // Los otros textos no cambian.
    expect(await versiones()).toEqual([anterior + 1, ...otrosAntes]);

    const correo = `nuevo.cliente.${Date.now()}@correo.co`;
    await comoLaWeb(app)
      .post('/auth/registro', {
        nombre: 'Cliente de la versión dos',
        cedula: String(Date.now()).slice(-10),
        correo,
        telefono: `310 ${String(Date.now()).slice(-7)}`,
        contrasena: 'una contraseña bien larga',
        aceptaTerminos: true,
        aceptaDatos: true,
        aceptaRiesgo: true,
      })
      .expect(202);
    const usuario = await fuente.getRepository(User).findOneByOrFail({ email: correo });
    const terminos = await fuente.getRepository(Consent).findOneByOrFail({
      userId: usuario.id,
      type: 'TERMS',
    });
    expect(terminos.legalDocumentId).toBe(publicada.body.id);
    expect(terminos.documentVersion).toBe(String(anterior + 1));
  });

  it('no publica un texto igual al vigente', async () => {
    await confirmar(token);
    const vigente = await comoLaWeb(app).get('/publico/legal/terminos').expect(200);
    const respuesta = await comoLaWeb(app, { token })
      .post('/admin/legal/TERMS', { contenido: vigente.body.contenido })
      .expect(400);
    expect(respuesta.body.codigo).toBe('SIN_CAMBIOS');
  });

  it('un texto publicado no se puede cambiar ni borrar en la base de datos', async () => {
    await expect(fuente.query(`UPDATE legal_documents SET content_md = 'x'`)).rejects.toThrow(
      /no se puede modificar/,
    );
    await expect(fuente.query(`DELETE FROM legal_documents`)).rejects.toThrow(
      /no se puede modificar/,
    );
  });
});

describe('preguntas frecuentes desde el panel', () => {
  let token: string;

  beforeAll(async () => {
    token = await adminConSesion();
  });

  it('guarda las preguntas y la landing las muestra en ese orden', async () => {
    const preguntas = [
      { pregunta: '¿Primera pregunta?', respuesta: 'Primera respuesta con **negrita**.' },
      { pregunta: '¿Segunda pregunta?', respuesta: 'Segunda respuesta.' },
    ];
    await comoLaWeb(app, { token }).put('/admin/preguntas', { preguntas }).expect(200);
    const landing = await comoLaWeb(app).get('/publico/landing').expect(200);
    expect(landing.body.preguntas).toEqual(preguntas);
  });

  it('rechaza preguntas vacías o campos de más', async () => {
    const vacia = await comoLaWeb(app, { token })
      .put('/admin/preguntas', { preguntas: [{ pregunta: '', respuesta: 'Algo' }] })
      .expect(400);
    expect(vacia.body.codigo).toBe('DATOS_INVALIDOS');
    await comoLaWeb(app, { token })
      .put('/admin/preguntas', {
        preguntas: [{ pregunta: '¿Pregunta válida?', respuesta: 'Respuesta válida.', html: '<b>' }],
      })
      .expect(400);
  });

  it('un cliente no puede cambiarlas', async () => {
    // Un cliente cualquiera: se registra, confirma el correo e ingresa.
    const correo = `cliente.preguntas.${Date.now()}@correo.co`;
    await comoLaWeb(app)
      .post('/auth/registro', {
        nombre: 'Cliente curioso',
        cedula: `9${String(Date.now()).slice(-9)}`,
        correo,
        telefono: `311 ${String(Date.now()).slice(-7)}`,
        contrasena: 'una contraseña bien larga',
        aceptaTerminos: true,
        aceptaDatos: true,
        aceptaRiesgo: true,
      })
      .expect(202);
    const aviso = await fuente.getRepository(Notification).findOneByOrFail({
      recipient: correo,
      template: 'verificar-correo',
    });
    const enlace = app.get(CifradoService).descifrar(aviso.secretEnc!, CONTEXTO_SECRETO_AVISO);
    await comoLaWeb(app).post('/auth/verificar-correo', { token: enlace }).expect(200);
    const ingreso = await comoLaWeb(app)
      .post('/auth/ingresar', { correo, contrasena: 'una contraseña bien larga' })
      .expect(200);
    await comoLaWeb(app, { token: ingreso.body.token })
      .put('/admin/preguntas', { preguntas: [] })
      .expect(403);
  });
});
