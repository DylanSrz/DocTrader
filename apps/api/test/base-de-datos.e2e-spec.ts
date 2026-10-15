import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { opcionesBaseDeDatos } from '../src/database/data-source.js';
import { DepositAddress, PartnerProfile, Plan, User } from '../src/database/entidades/index.js';
import { PlanesYMarca1792400000000 } from '../src/database/migraciones/1792400000000-planes-y-marca.js';
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
  it('carga los planes con sus precios: sin trimestral y la semestral de 6 meses', async () => {
    const planes = await fuente.getRepository(Plan).find({ order: { rank: 'ASC' } });
    expect(planes.map((p) => [p.code, p.priceUsdCents, p.bonusMonths])).toEqual([
      ['PRUEBA', 5_000, 0],
      ['MENSUAL', 12_000, 0],
      ['SEMESTRAL', 49_900, 0],
    ]);
  });

  it('en una base de datos que ya existía, retira la trimestral, quita el obsequio y corrige los textos', async () => {
    // Como estaba producción antes del 2026-10-15.
    await fuente.query(
      `INSERT INTO plans (code, name, duration_months, bonus_months, price_usd_cents, rank, is_public)
       VALUES ('TRIMESTRAL', 'Trimestral', 3, 0, 31900, 2, true)`,
    );
    await fuente.query(`UPDATE plans SET bonus_months = 1 WHERE code = 'SEMESTRAL'`);
    const [vigente] = (await fuente.query(
      `SELECT max(version) AS version FROM legal_documents WHERE type = 'TERMS'`,
    )) as { version: number }[];
    const viejo = [
      '| Mensual | 1 mes | USD 120 |',
      '| Trimestral | 3 meses | USD 319 |',
      '| Semestral | 7 meses (6 meses + 1 mes de obsequio) | USD 499 |',
      '',
      '5.4. **Cambio a un plan más largo:** antes de vencer, una licencia mensual puede pasarse a trimestral o semestral, y',
      'una trimestral a semestral. Se paga el precio completo del plan nuevo.',
      '',
      '5.5. El mes de obsequio del plan semestral se aplica de forma automática y no se puede cambiar por dinero.',
      '',
      'la diferencia (hoy USD 70 para mensual, USD 269 para trimestral y USD 449 para semestral). En ese caso, la',
      'licencia cuenta desde el día en que empezó la prueba; si es semestral, incluye el mes de obsequio.',
    ].join('\n');
    await fuente.query(
      `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2)`,
      [vigente!.version + 1, viejo],
    );
    const [faqAntes] = (await fuente.query(`SELECT value FROM settings WHERE key = 'faq'`)) as {
      value: { pregunta: string; respuesta: string }[];
    }[];
    await fuente.query(`UPDATE settings SET value = $1::jsonb WHERE key = 'faq'`, [
      JSON.stringify([
        {
          pregunta: '¿Qué broker?',
          respuesta: 'Si no tienes uno, yo uso [JustMarkets](https://x.co).',
        },
      ]),
    ]);

    const corredor = fuente.createQueryRunner();
    try {
      await new PlanesYMarca1792400000000().up(corredor);
    } finally {
      await corredor.release();
    }

    const planes = await fuente.getRepository(Plan).findBy({});
    expect(planes.find((p) => p.code === 'TRIMESTRAL')).toMatchObject({
      isActive: false,
      isPublic: false,
    });
    expect(planes.find((p) => p.code === 'SEMESTRAL')!.bonusMonths).toBe(0);

    const [nuevo] = (await fuente.query(
      `SELECT version, content_md FROM legal_documents WHERE type = 'TERMS' ORDER BY version DESC LIMIT 1`,
    )) as { version: number; content_md: string }[];
    expect(nuevo!.version).toBe(vigente!.version + 2);
    expect(nuevo!.content_md).not.toMatch(/trimestral|obsequio|269/i);
    expect(nuevo!.content_md).toContain('| Semestral | 6 meses | USD 499 |');
    expect(nuevo!.content_md).toContain('una licencia mensual puede pasarse a semestral. Se paga');

    const [faq] = (await fuente.query(`SELECT value FROM settings WHERE key = 'faq'`)) as {
      value: { respuesta: string }[];
    }[];
    expect(faq!.value[0]!.respuesta).toBe(
      'Si no tienes uno, te sugerimos [JustMarkets](https://x.co).',
    );

    // Correrla de nuevo no publica otra versión.
    const otra = fuente.createQueryRunner();
    try {
      await new PlanesYMarca1792400000000().up(otra);
    } finally {
      await otra.release();
    }
    const [ultima] = (await fuente.query(
      `SELECT max(version) AS version FROM legal_documents WHERE type = 'TERMS'`,
    )) as { version: number }[];
    expect(ultima!.version).toBe(vigente!.version + 2);

    // Deja la base de datos como la dejó la semilla, para las demás pruebas.
    await fuente.query(`DELETE FROM plans WHERE code = 'TRIMESTRAL'`);
    await fuente.query(`UPDATE settings SET value = $1::jsonb WHERE key = 'faq'`, [
      JSON.stringify(faqAntes!.value),
    ]);
  });

  it('carga las dos direcciones de Binance activas y los dos admins, con Dylan como socio al 10 %', async () => {
    // Las de la semilla no tienen autor; las que agregan otras pruebas desde el panel, sí.
    const direcciones = await fuente
      .getRepository(DepositAddress)
      .find({ where: { createdBy: IsNull() } });
    expect(direcciones.map((d) => `${d.currency}:${d.status}`).sort()).toEqual([
      'BTC:ACTIVA',
      'USDT:ACTIVA',
    ]);

    // Otras pruebas crean admins propios (con dominio doctraderpro.com): aquí cuentan solo los de la semilla.
    const admins = await fuente.getRepository(User).findBy({ role: 'ADMIN' });
    expect(
      admins
        .map((a) => a.email)
        .filter((c) => c.endsWith('@gmail.com'))
        .sort(),
    ).toEqual(['doctraderproiasystem@gmail.com', 'dylansrz96@gmail.com']);

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
       VALUES ('ADMIN', 'Admin viejo', 'doctraderpro@gmail.com', 'doctraderpro@gmail.com', 'hash', now())
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
