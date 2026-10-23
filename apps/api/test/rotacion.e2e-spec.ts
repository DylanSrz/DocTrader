import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { registrarEnCadena, verificarCadena } from '../src/auditoria/cadena.js';
import { conectarRotandoContrasena } from '../src/database/rotacion.js';
import { cifrar, descifrar } from '../src/seguridad/cifrado.js';
import { recifrarDatos } from '../src/seguridad/recifrado.js';
import { adminConSesion } from './ayudas.js';
import { crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;

const vieja = Buffer.from(process.env.DATA_ENCRYPTION_KEY!, 'base64');
const nueva = Buffer.alloc(32, 99);
const auditoriaVieja = Buffer.from(process.env.AUDIT_HMAC_KEY!, 'base64');
const auditoriaNueva = Buffer.alloc(32, 98);

beforeAll(async () => {
  app = await crearApp();
  fuente = app.get(getDataSourceToken());
});

afterAll(async () => {
  await app.close();
});

class Deshacer extends Error {}

/** Corre `prueba` en una transacción que siempre se deshace: las llaves de prueba no quedan para las demás. */
async function sinDejarRastro(prueba: (m: EntityManager) => Promise<void>): Promise<void> {
  await expect(
    fuente.transaction(async (m) => {
      await prueba(m);
      throw new Deshacer();
    }),
  ).rejects.toBeInstanceOf(Deshacer);
}

describe('rotación de credenciales', () => {
  it('vuelve a cifrar con la llave nueva lo que estaba con la vieja, una sola vez', async () => {
    const admin = await adminConSesion(app);
    await sinDejarRastro(async (m) => {
      const llaves = new Map([
        [1, vieja],
        [2, nueva],
      ]);
      const primero = await recifrarDatos(m, 2, llaves);
      expect(primero['users.totp_secret_enc']).toBeGreaterThanOrEqual(1);

      const [fila] = (await m.query(`SELECT totp_secret_enc AS dato FROM users WHERE id = $1`, [
        admin.usuario.id,
      ])) as { dato: Buffer }[];
      expect(fila!.dato[0]).toBe(2);
      // Se lee con la nueva sola y da el mismo secreto que antes.
      expect(descifrar(new Map([[2, nueva]]), fila!.dato, 'users.totp').toString()).toBe(
        descifrar(new Map([[1, vieja]]), admin.usuario.totpSecretEnc!, 'users.totp').toString(),
      );

      // Repetirlo no cambia nada.
      expect(await recifrarDatos(m, 2, llaves)).toEqual({});
    });
  });

  it('no cambia nada si un dato no se puede leer con ninguna llave', async () => {
    const admin = await adminConSesion(app);
    await sinDejarRastro(async (m) => {
      await m.query(`UPDATE users SET totp_secret_enc = $1 WHERE id = $2`, [
        cifrar(Buffer.alloc(32, 1), 7, 'otro', 'users.totp'),
        admin.usuario.id,
      ]);
      await expect(
        recifrarDatos(
          m,
          2,
          new Map([
            [1, vieja],
            [2, nueva],
          ]),
        ),
      ).rejects.toThrow(/versión 7/);
    });
  });

  it('la auditoría se revisa con la llave anterior hasta la primera fila de la nueva', async () => {
    await sinDejarRastro(async (m) => {
      await registrarEnCadena(m, auditoriaVieja, { action: 'prueba.antes' });
      await registrarEnCadena(m, auditoriaNueva, { action: 'prueba.despues' });

      expect(await verificarCadena(m, [auditoriaVieja, auditoriaNueva])).toEqual({ valida: true });
      // Sin la anterior, las filas viejas no validan; con solo la vieja, las nuevas tampoco.
      expect((await verificarCadena(m, [auditoriaNueva])).valida).toBe(false);
      expect((await verificarCadena(m, [auditoriaVieja])).valida).toBe(false);

      // Una fila con la llave retirada después de la nueva rompe la cadena.
      const rota = await registrarEnCadena(m, auditoriaVieja, { action: 'prueba.vuelta-atras' });
      expect(await verificarCadena(m, [auditoriaVieja, auditoriaNueva])).toEqual({
        valida: false,
        filaRota: rota.id,
      });
    });
  });

  it('entra con la contraseña anterior, la cambia por la de la dirección y se reconecta', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    const original = decodeURIComponent(url.password);
    const nuevaContrasena = "nueva'contrasena-con-comilla-456";
    const conNueva = new URL(url);
    conNueva.password = encodeURIComponent(nuevaContrasena);
    try {
      // Sin la anterior, una contraseña que la base no conoce falla como siempre.
      await expect(
        conectarRotandoContrasena(conNueva.toString(), false, undefined, auditoriaVieja),
      ).rejects.toThrow(/password/);

      const primera = await conectarRotandoContrasena(
        conNueva.toString(),
        false,
        original,
        auditoriaVieja,
      );
      expect(primera.contrasenaCambiada).toBe(true);
      await primera.fuente.destroy();

      // La segunda vez ya entra con la nueva y no cambia nada.
      const segunda = await conectarRotandoContrasena(
        conNueva.toString(),
        false,
        original,
        auditoriaVieja,
      );
      expect(segunda.contrasenaCambiada).toBe(false);
      await segunda.fuente.destroy();
    } finally {
      // Las demás pruebas se conectan con la original: se restaura con la misma función.
      const restaurar = await conectarRotandoContrasena(
        url.toString(),
        false,
        nuevaContrasena,
        auditoriaVieja,
      );
      await restaurar.fuente.destroy();
    }
    const acciones = (await fuente.query(
      `SELECT action FROM audit_log WHERE action = 'seguridad.contrasena_db_cambiada'`,
    )) as unknown[];
    expect(acciones.length).toBeGreaterThanOrEqual(2);
    expect((await verificarCadena(fuente.manager, auditoriaVieja)).valida).toBe(true);
  });
});
