import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { Secret, TOTP } from 'otpauth';
import type { DataSource } from 'typeorm';
import { CONTEXTO_SECRETO_AVISO } from '../src/avisos/avisos.service.js';
import { Notification, User } from '../src/database/entidades/index.js';
import { REDIS } from '../src/redis/redis.module.js';
import { CifradoService } from '../src/seguridad/cifrado.service.js';
import { ContrasenasService } from '../src/seguridad/contrasenas.service.js';
import { comoLaWeb } from './crear-app.js';

/** Personas listas para las pruebas: un cliente con su correo confirmado y un admin con segundo factor. */

let consecutivo = 0;
const unico = () => `${Date.now()}${(consecutivo += 1)}`;

export async function clienteConSesion(app: INestApplication) {
  const fuente = app.get<DataSource>(getDataSourceToken());
  const id = unico();
  const correo = `cliente.${id}@correo.co`;
  const contrasena = 'una contraseña bien larga';
  await comoLaWeb(app)
    .post('/auth/registro', {
      nombre: 'Laura Gómez Restrepo',
      cedula: id.slice(-10),
      correo,
      telefono: `32${id.slice(-8)}`,
      contrasena,
      aceptaTerminos: true,
      aceptaDatos: true,
      aceptaRiesgo: true,
    })
    .expect(202);
  const aviso = await fuente
    .getRepository(Notification)
    .findOneByOrFail({ recipient: correo, template: 'verificar-correo' });
  const enlace = app.get(CifradoService).descifrar(aviso.secretEnc!, CONTEXTO_SECRETO_AVISO);
  await comoLaWeb(app).post('/auth/verificar-correo', { token: enlace }).expect(200);
  const ingreso = await comoLaWeb(app).post('/auth/ingresar', { correo, contrasena }).expect(200);
  const usuario = await fuente.getRepository(User).findOneByOrFail({ email: correo });
  return { web: comoLaWeb(app, { token: ingreso.body.token as string }), usuario, correo };
}

/** Un admin con contraseña y segundo factor, ya dentro, y una forma de confirmar con su código. */
export async function adminConSesion(app: INestApplication) {
  const fuente = app.get<DataSource>(getDataSourceToken());
  const redis = app.get<Redis>(REDIS);
  const secreto = new Secret({ size: 20 }).base32;
  const codigo = () => new TOTP({ secret: Secret.fromBase32(secreto) }).generate();
  const olvidarCodigos = async () => {
    const claves = await redis.keys('totp:usado:*');
    if (claves.length > 0) await redis.del(...claves);
  };
  const correo = `admin.${unico()}@doctraderpro.com`;
  const contrasena = 'contraseña de admin de pruebas';
  await fuente.getRepository(User).insert({
    role: 'ADMIN',
    fullName: 'Admin de pruebas',
    email: correo,
    emailCanonical: correo,
    emailVerifiedAt: new Date(),
    passwordHash: await app.get(ContrasenasService).crearHash(contrasena),
    totpSecretEnc: app.get(CifradoService).cifrar(secreto, 'users.totp'),
    totpEnabledAt: new Date(),
  });
  const ingreso = await comoLaWeb(app).post('/auth/ingresar', { correo, contrasena }).expect(200);
  await olvidarCodigos();
  const completo = await comoLaWeb(app, { token: ingreso.body.token })
    .post('/auth/segundo-factor', { codigo: codigo() })
    .expect(200);
  const token = completo.body.token as string;
  const usuario = await fuente.getRepository(User).findOneByOrFail({ email: correo });
  return {
    web: comoLaWeb(app, { token }),
    usuario,
    confirmar: async () => {
      await olvidarCodigos();
      await comoLaWeb(app, { token }).post('/auth/confirmar', { codigo: codigo() }).expect(200);
    },
  };
}

// Distinto en cada archivo de pruebas: la base de datos es la misma para todos.
let numeroCuenta = Date.now();

export function datosCuenta(cambios: Record<string, string> = {}) {
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

/** Un hash de 64 caracteres hexadecimales distinto cada vez. */
export function hashNuevo(): string {
  return `${Date.now().toString(16)}${(consecutivo += 1).toString(16)}`.padEnd(64, 'e');
}
