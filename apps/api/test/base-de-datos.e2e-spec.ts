import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { opcionesBaseDeDatos } from '../src/database/data-source.js';
import { DepositAddress, PartnerProfile, Plan, User } from '../src/database/entidades/index.js';
import { quitarPruebaDeTextosLegales } from '../src/database/migraciones/1792800000000-quitar-prueba.js';
import { PlanesYMarca1792400000000 } from '../src/database/migraciones/1792400000000-planes-y-marca.js';
import { ReferidosDosNiveles1793400000000 } from '../src/database/migraciones/1793400000000-referidos-dos-niveles.js';
import { TerminosReferidos1793300000000 } from '../src/database/migraciones/1793300000000-terminos-referidos.js';
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

  it('publica los términos y la política de datos sin la licencia de prueba, una sola vez', async () => {
    const terminos = [
      '## 5. Planes y precios',
      '',
      '5.1. Planes.',
      '',
      '## 6. Licencia de prueba',
      '',
      '6.1. La licencia de prueba dura **15 días** y cuesta **USD 50**.',
      '',
      '6.2. Para solicitarla, el Cliente debe tener su correo y su teléfono verificados.',
      '',
      '## 7. Pagos',
      '',
      '7.1. Solo cripto.',
      '',
      '8.3. La licencia de prueba existe para que el Cliente conozca el Software antes de comprar un periodo más largo.',
      '',
      '13.1. Si da datos falsos, intenta abusar de la prueba, comparte su licencia, o algo más.',
    ].join('\n');
    const datos = [
      '1. Crear y administrar la cuenta del cliente y verificar su correo y su teléfono.',
      '',
      '## 6. Registro para el control de la licencia de prueba',
      '',
      'Huellas de la prueba.',
      '',
      '## 7. Autorización',
      '',
      'Texto.',
      '',
      '| Huellas del control de la prueba | Mientras exista el programa de pruebas (numeral 6) |',
      '',
    ].join('\n');
    const version = async (tipo: string) =>
      (
        (await fuente.query(`SELECT max(version)::int AS v FROM legal_documents WHERE type = $1`, [
          tipo,
        ])) as { v: number }[]
      )[0]!.v;
    const [t0, d0] = [await version('TERMS'), await version('PRIVACY')];
    await fuente.query(
      `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2), ('PRIVACY', $3, $4)`,
      [t0 + 1, terminos, d0 + 1, datos],
    );

    for (let i = 0; i < 2; i++) {
      const corredor = fuente.createQueryRunner();
      try {
        await quitarPruebaDeTextosLegales(corredor);
      } finally {
        await corredor.release();
      }
    }

    const ultimo = async (tipo: string) =>
      (
        (await fuente.query(
          `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
          [tipo],
        )) as { version: number; content_md: string }[]
      )[0]!;
    const t = await ultimo('TERMS');
    expect(t.version).toBe(t0 + 2);
    expect(t.content_md).toContain('## 6. Sin licencia de prueba');
    expect(t.content_md).toContain('## 7. Pagos');
    expect(t.content_md).not.toMatch(/USD 50|abusar de la prueba|La licencia de prueba existe/);
    const d = await ultimo('PRIVACY');
    expect(d.version).toBe(d0 + 2);
    expect(d.content_md).toContain('## 6. Datos cifrados para prevenir el fraude');
    expect(d.content_md).toContain('verificar su correo.');
    expect(d.content_md).not.toMatch(/programa de pruebas|control de la licencia de prueba/);
  });

  it('publica la sección de referidos en los términos y la política, renumerada, una sola vez', async () => {
    const terminos = [
      '## 15. Enlaces de terceros y de referido',
      '',
      'Broker.',
      '',
      '## 16. Soporte y comunicaciones',
      '',
      '16.1. Tickets.',
      '',
      '## 19. Ley aplicable y controversias',
      '',
      '## 20. Contacto',
      '',
    ].join('\n');
    const datos = [
      '| Soporte | Mensajes, archivos adjuntos y respuestas | Al abrir o responder un ticket |',
      '',
      '10. Enviar novedades del servicio, solo si el Titular lo acepta por separado. Puede cancelarlas cuando quiera.',
      '',
      '- **Autoridades** que lo pidan en ejercicio de sus funciones legales.',
      '',
    ].join('\n');
    const ultimo = async (tipo: string) =>
      (
        (await fuente.query(
          `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
          [tipo],
        )) as { version: number; content_md: string }[]
      )[0]!;
    const [t0, d0] = [(await ultimo('TERMS')).version, (await ultimo('PRIVACY')).version];
    await fuente.query(
      `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2), ('PRIVACY', $3, $4)`,
      [t0 + 1, terminos, d0 + 1, datos],
    );

    for (let i = 0; i < 2; i++) {
      const corredor = fuente.createQueryRunner();
      try {
        await new TerminosReferidos1793300000000().up(corredor);
      } finally {
        await corredor.release();
      }
    }

    const t = await ultimo('TERMS');
    expect(t.version).toBe(t0 + 2);
    expect(t.content_md).toMatch(
      /## 15\. Enlaces[\s\S]*## 16\. Programa de referidos[\s\S]*16\.8\.[\s\S]*## 17\. Soporte[\s\S]*17\.1\. Tickets[\s\S]*## 20\. Ley[\s\S]*## 21\. Contacto/,
    );
    const d = await ultimo('PRIVACY');
    expect(d.version).toBe(d0 + 2);
    expect(d.content_md).toContain('| Programa de referidos |');
    expect(d.content_md).toContain('11. Administrar el programa de referidos');
    expect(d.content_md).toMatch(/\*\*Quien invitó al Titular\*\*[\s\S]*\*\*Autoridades\*\*/);
  });

  it('pasa los referidos a dos niveles: 15 % y 5 %, y publica el nuevo 16.2 de los términos', async () => {
    const ultimo = async (tipo: string) =>
      (
        (await fuente.query(
          `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
          [tipo],
        )) as { version: number; content_md: string }[]
      )[0]!;
    const correr = async (paso: 'up' | 'down') => {
      const corredor = fuente.createQueryRunner();
      try {
        await new ReferidosDosNiveles1793400000000()[paso](corredor);
      } finally {
        await corredor.release();
      }
    };
    // Como estaba producción antes del cambio: un solo nivel, 20 % y el 16.2 de entonces.
    await correr('down');
    const antes = (await ultimo('TERMS')).version;
    await fuente.query(
      `INSERT INTO legal_documents (type, version, content_md) VALUES ('TERMS', $1, $2)`,
      [
        antes + 1,
        [
          '## 16. Programa de referidos',
          '',
          '16.2. **Comisión.** Cuando una persona se registra con el enlace o el código de un Referidor, cada licencia o renovación',
          'que pague le deja al Referidor el porcentaje vigente publicado en la plataforma (hoy, el 20 % de lo pagado), mientras',
          'siga siendo cliente. El porcentaje se fija al aprobar cada pago. Las compras aprobadas mientras la licencia del',
          'Referidor esté vencida no generan comisión, salvo que DocTraderPRO lo haya habilitado.',
          '',
        ].join('\n'),
      ],
    );
    await fuente.query(
      `UPDATE settings SET value = '2000'::jsonb WHERE key = 'referrals.percentage_bp'`,
    );

    await correr('up');
    const t = await ultimo('TERMS');
    expect(t.version).toBe(antes + 2);
    expect(t.content_md).toContain('(hoy, el 15 % de lo pagado)');
    expect(t.content_md).toContain('**segunda línea**');
    const ajustes = (await fuente.query(
      `SELECT key, value FROM settings WHERE key IN ('referrals.percentage_bp', 'referrals.level2_bp') ORDER BY key`,
    )) as { key: string; value: number }[];
    expect(ajustes).toEqual([
      { key: 'referrals.level2_bp', value: 500 },
      { key: 'referrals.percentage_bp', value: 1500 },
    ]);
    const columnas = (await fuente.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'payment_orders' AND column_name LIKE 'referr%'`,
    )) as unknown[];
    expect(columnas).toHaveLength(0);
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
