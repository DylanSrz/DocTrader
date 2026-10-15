import {
  ESTADO_DIRECCION,
  ESTADO_USUARIO,
  MONEDA,
  PLANES_INICIALES,
  RED,
  ROL,
  correoCanonico,
} from '@doctrader/shared';
import type { DataSource } from 'typeorm';
import { registrarEnCadena } from '../auditoria/cadena.js';
import {
  AuthToken,
  DepositAddress,
  PartnerProfile,
  Plan,
  RecoveryCode,
  User,
} from './entidades/index.js';
import type { ValorJson } from './entidades/setting.entity.js';

/**
 * Datos con los que arranca la plataforma. Se puede correr varias veces: lo que ya existe no se toca, así un
 * precio o un ajuste cambiado desde el panel nunca se pisa.
 */

const ADMINS = [
  { fullName: 'Dylan', email: 'dylansrz96@gmail.com', socioConComisionBp: 1_000 },
  { fullName: 'Argemiro', email: 'doctraderproiasystem@gmail.com', socioConComisionBp: null },
] as const;

/**
 * Correos que fueron de admin por error y ya no lo son. La cuenta queda borrada, sin contraseña, sin segundo
 * factor y sin enlaces pendientes, para que nadie con acceso a ese buzón pueda tomarla.
 * 2026-10-15: el correo de admin de Argemiro era doctraderproiasystem@gmail.com, no doctraderpro@gmail.com.
 */
const ADMINS_RETIRADOS = ['doctraderpro@gmail.com'] as const;

/** Direcciones de la cuenta de Binance de Argemiro (2026-10-14), con checksum comprobado. */
const DIRECCIONES = [
  { currency: MONEDA.USDT, network: RED.TRON, address: 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x' },
  { currency: MONEDA.BTC, network: RED.BITCOIN, address: '1H8xfingRtsTvhnf4PosyhXvacXdGVWea1' },
] as const;

const AJUSTES: Record<string, ValorJson> = {
  grace_days: 3,
  order_ttl_minutes: 60,
  min_confirmations: { TRON: 20, BITCOIN: 2 },
  auto_approve_payments: false,
  'trial.require_verified_contact': true,
  'trial.require_id_photo': false,
  'tickets.auto_close_days': 7,
  links: {
    telegram: 'https://t.me/+cdmWH_xLubdhMDhh',
    instagram: 'https://www.instagram.com/doctraderproiasystem/',
    broker: { name: 'JustMarkets', url: 'https://one.justmarkets.link/a/5vmbn05zda' },
  },
  myfxbook: {
    url: 'https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459',
    accountId: '12253459',
    // Solo la ganancia mientras el historial esté incompleto (ver docs/PENDIENTES.md).
    figures: {
      gainPercent: '246.68',
      maxDrawdownPercent: null,
      auditedSince: null,
      asOf: '2026-10-14',
    },
  },
  support_email: 'support@doctraderpro.com',
};

/** Aplica la semilla y devuelve lo que creó (vacío si ya estaba todo). */
export async function aplicarSemilla(
  fuente: DataSource,
  llaveAuditoria: Buffer,
): Promise<string[]> {
  const creado: string[] = [];
  await fuente.transaction(async (m) => {
    for (const plan of PLANES_INICIALES) {
      const r = await m
        .createQueryBuilder()
        .insert()
        .into(Plan)
        .values({ ...plan })
        .orIgnore()
        .execute();
      if (insertoFilas(r.raw)) creado.push(`plan ${plan.code}`);
    }

    for (const [key, value] of Object.entries(AJUSTES)) {
      const filas: unknown = await m.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key',
        [key, JSON.stringify(value)],
      );
      if (insertoFilas(filas)) creado.push(`ajuste ${key}`);
    }

    const ahora = new Date();
    for (const d of DIRECCIONES) {
      const existe = await m.getRepository(DepositAddress).exists({
        where: { network: d.network, address: d.address },
      });
      if (existe) continue;
      // Las iniciales entran activas: la espera de 24 horas aplica a las que se agreguen desde el panel.
      await m.getRepository(DepositAddress).insert({
        ...d,
        status: ESTADO_DIRECCION.ACTIVA,
        activatesAt: ahora,
      });
      creado.push(`dirección ${d.currency} ${d.network}`);
    }

    for (const correo of ADMINS_RETIRADOS) {
      const retirado = await m.getRepository(User).findOneBy({
        emailCanonical: correoCanonico(correo),
        role: ROL.ADMIN,
      });
      if (!retirado || retirado.status === ESTADO_USUARIO.BORRADO) continue;
      const teniaContrasena = retirado.passwordHash !== null;
      await m.getRepository(User).update(retirado.id, {
        status: ESTADO_USUARIO.BORRADO,
        deletedAt: ahora,
        passwordHash: null,
        totpSecretEnc: null,
        totpEnabledAt: null,
      });
      await m.getRepository(RecoveryCode).delete({ userId: retirado.id });
      await m
        .getRepository(AuthToken)
        .createQueryBuilder()
        .update()
        .set({ usedAt: ahora })
        .where('user_id = :id AND used_at IS NULL', { id: retirado.id })
        .execute();
      await registrarEnCadena(m, llaveAuditoria, {
        actorRole: 'SISTEMA',
        action: 'usuario.admin_retirado',
        targetType: 'user',
        targetId: retirado.id,
        metadata: { correo, teniaContrasena },
      });
      creado.push(`admin retirado ${correo}`);
    }

    for (const admin of ADMINS) {
      const emailCanonical = correoCanonico(admin.email);
      let usuario = await m.getRepository(User).findOneBy({ emailCanonical });
      if (!usuario) {
        usuario = await m.getRepository(User).save(
          m.getRepository(User).create({
            role: ROL.ADMIN,
            fullName: admin.fullName,
            email: admin.email,
            emailCanonical,
          }),
        );
        creado.push(`admin ${admin.email}`);
      }
      if (admin.socioConComisionBp !== null) {
        const r = await m
          .createQueryBuilder()
          .insert()
          .into(PartnerProfile)
          .values({ userId: usuario.id, commissionBp: admin.socioConComisionBp })
          .orIgnore()
          .execute();
        if (insertoFilas(r.raw)) creado.push(`perfil de socio de ${admin.email}`);
      }
    }

    if (creado.length) {
      await registrarEnCadena(m, llaveAuditoria, {
        actorRole: 'SISTEMA',
        action: 'sistema.semilla',
        metadata: { creado },
      });
    }
  });
  return creado;
}

/** En Postgres, `raw` trae las filas que devolvió el INSERT: vacío si `ON CONFLICT DO NOTHING` no insertó nada. */
function insertoFilas(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}
