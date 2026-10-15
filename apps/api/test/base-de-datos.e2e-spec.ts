import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { opcionesBaseDeDatos } from '../src/database/data-source.js';
import { DepositAddress, PartnerProfile, Plan, User } from '../src/database/entidades/index.js';
import { aplicarSemilla } from '../src/database/semilla-datos.js';
import { registrarEnCadena, verificarCadena } from '../src/auditoria/cadena.js';

const llave = Buffer.from(process.env.AUDIT_HMAC_KEY!, 'base64');
let fuente: DataSource;

beforeAll(async () => {
  fuente = new DataSource(opcionesBaseDeDatos(process.env.DATABASE_URL!, false));
  await fuente.initialize();
});

afterAll(async () => {
  await fuente.destroy();
});

describe('semilla', () => {
  it('carga los cuatro planes con sus precios', async () => {
    const planes = await fuente.getRepository(Plan).find({ order: { rank: 'ASC' } });
    expect(planes.map((p) => [p.code, p.priceUsdCents])).toEqual([
      ['PRUEBA', 5_000],
      ['MENSUAL', 12_000],
      ['TRIMESTRAL', 31_900],
      ['SEMESTRAL', 49_900],
    ]);
  });

  it('carga las dos direcciones de Binance activas y los dos admins, con Dylan como socio al 10 %', async () => {
    const direcciones = await fuente.getRepository(DepositAddress).find();
    expect(direcciones.map((d) => `${d.currency}:${d.status}`).sort()).toEqual([
      'BTC:ACTIVA',
      'USDT:ACTIVA',
    ]);

    const admins = await fuente.getRepository(User).findBy({ role: 'ADMIN' });
    expect(admins.map((a) => a.email).sort()).toEqual([
      'doctraderproiasystem@gmail.com',
      'dylansrz96@gmail.com',
    ]);

    const socio = await fuente.getRepository(PartnerProfile).find();
    expect(socio).toHaveLength(1);
    expect(socio[0]!.commissionBp).toBe(1_000);
  });

  it('se puede volver a correr sin crear nada nuevo', async () => {
    expect(await aplicarSemilla(fuente, llave)).toEqual([]);
  });

  it('retira el admin que se registró con un correo equivocado y crea el correcto', async () => {
    const [viejo] = (await fuente.query(
      `INSERT INTO users (role, full_name, email, email_canonical, password_hash, totp_enabled_at)
       VALUES ('ADMIN', 'Argemiro', 'doctraderpro@gmail.com', 'doctraderpro@gmail.com', 'hash', now())
       RETURNING id`,
    )) as { id: string }[];
    await fuente.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'RESET_PASSWORD', '\\x01', now() + interval '30 minutes')`,
      [viejo!.id],
    );

    expect(await aplicarSemilla(fuente, llave)).toEqual(['admin retirado doctraderpro@gmail.com']);

    const retirado = await fuente.getRepository(User).findOneByOrFail({ id: viejo!.id });
    expect(retirado.status).toBe('DELETED');
    expect(retirado.passwordHash).toBeNull();
    expect(retirado.totpEnabledAt).toBeNull();
    const pendientes = await fuente.query(
      `SELECT count(*)::int AS n FROM auth_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [viejo!.id],
    );
    expect(pendientes[0].n).toBe(0);
    // La segunda vez ya no hay nada que retirar.
    expect(await aplicarSemilla(fuente, llave)).toEqual([]);
  });

  it('genera ids UUID v7', async () => {
    const plan = await fuente.getRepository(Plan).findOneByOrFail({ code: 'MENSUAL' });
    expect(plan.id[14]).toBe('7');
  });
});

describe('reglas de la base de datos', () => {
  it('un cliente siempre tiene cédula y teléfono', async () => {
    await expect(
      fuente.query(
        `INSERT INTO users (role, full_name, email, email_canonical) VALUES ('CLIENT', 'Sin datos', 'x@y.co', 'x@y.co')`,
      ),
    ).rejects.toThrow(/check/i);
  });

  it('una dirección de USDT solo puede ir por Tron', async () => {
    await expect(
      fuente.query(
        `INSERT INTO deposit_addresses (currency, network, address, status, activates_at)
         VALUES ('USDT', 'BITCOIN', 'x', 'EN_ESPERA', now())`,
      ),
    ).rejects.toThrow(/check/i);
  });
});

describe('auditoría', () => {
  it('encadena las filas y detecta si la cadena está íntegra', async () => {
    await fuente.transaction((m) =>
      registrarEnCadena(m, llave, { action: 'prueba.uno', metadata: { a: 1 } }),
    );
    await fuente.transaction((m) => registrarEnCadena(m, llave, { action: 'prueba.dos' }));
    expect(await verificarCadena(fuente.manager, llave)).toEqual({ valida: true });
  });

  it('con otra llave, la cadena no valida', async () => {
    expect((await verificarCadena(fuente.manager, Buffer.alloc(32, 1))).valida).toBe(false);
  });

  it('nadie puede cambiar, borrar ni vaciar la auditoría', async () => {
    await expect(fuente.query(`UPDATE audit_log SET action = 'x'`)).rejects.toThrow(/no se puede/);
    await expect(fuente.query(`DELETE FROM audit_log`)).rejects.toThrow(/no se puede/);
    await expect(fuente.query(`TRUNCATE audit_log`)).rejects.toThrow(/no se puede/);
  });

  it('dos escrituras al mismo tiempo no rompen la cadena', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        fuente.transaction((m) => registrarEnCadena(m, llave, { action: `prueba.paralela.${i}` })),
      ),
    );
    expect(await verificarCadena(fuente.manager, llave)).toEqual({ valida: true });
  });

  it('fuera de una transacción no se puede escribir', async () => {
    await expect(registrarEnCadena(fuente.manager, llave, { action: 'x' })).rejects.toThrow(
      /transacción/,
    );
  });
});
