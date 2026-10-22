import { randomInt } from 'node:crypto';
import {
  aplicarPorcentaje,
  codigoAleatorio,
  normalizarCodigo,
  REFERIDOS_INICIAL,
} from '@doctrader/shared';
import type { EntityManager } from 'typeorm';

/**
 * Reglas del programa de referidos que usan la aprobación de pagos y el registro. Son funciones sobre la transacción
 * de quien llama (sin servicios de Nest), así `PagosModule` y `AccesoModule` no dependen de `ReferidosModule`.
 */

export interface AjustesReferidos {
  /** Primera línea: quienes se registraron con el código del referidor. */
  porcentajeBp: number;
  /** Segunda línea: quienes invitaron sus referidos. */
  segundaLineaBp: number;
  minimoPagoUsdCents: number;
  activo: boolean;
}

export async function leerAjustesReferidos(m: EntityManager): Promise<AjustesReferidos> {
  const filas = (await m.query(
    `SELECT key, value FROM settings
      WHERE key IN ('referrals.percentage_bp', 'referrals.level2_bp', 'referrals.min_payout_usd_cents',
                    'referrals.enabled')`,
  )) as { key: string; value: unknown }[];
  const valor = new Map(filas.map((f) => [f.key, f.value]));
  const entero = (v: unknown, porDefecto: number) =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : porDefecto;
  return {
    porcentajeBp: entero(valor.get('referrals.percentage_bp'), REFERIDOS_INICIAL.porcentajeBp),
    segundaLineaBp: entero(valor.get('referrals.level2_bp'), REFERIDOS_INICIAL.segundaLineaBp),
    minimoPagoUsdCents: entero(
      valor.get('referrals.min_payout_usd_cents'),
      REFERIDOS_INICIAL.minimoPagoUsdCents,
    ),
    activo: valor.has('referrals.enabled')
      ? valor.get('referrals.enabled') === true
      : REFERIDOS_INICIAL.activo,
  };
}

/**
 * Por qué alguien puede referir hoy, o `null` si no puede:
 * - `HABILITADO`: un admin lo habilitó (aunque no tenga licencia);
 * - `SOCIO`: el socio desarrollador refiere con su cuenta de admin (2026-10-22);
 * - `LICENCIA`: tiene una licencia activa o en gracia.
 * Una cuenta suspendida o eliminada no refiere.
 */
export type ViaReferidor = 'HABILITADO' | 'SOCIO' | 'LICENCIA';

export async function viaParaReferir(
  m: EntityManager,
  usuarioId: string,
): Promise<ViaReferidor | null> {
  const [fila] = (await m.query(
    `SELECT u.status,
            coalesce(r.enabled_by_admin, false) AS habilitado,
            EXISTS (SELECT 1 FROM partner_profiles p WHERE p.user_id = u.id) AS socio,
            EXISTS (SELECT 1 FROM licenses l WHERE l.user_id = u.id AND l.status IN ('ACTIVA', 'EN_GRACIA'))
              AS licencia
       FROM users u LEFT JOIN referral_profiles r ON r.user_id = u.id
      WHERE u.id = $1`,
    [usuarioId],
  )) as { status: string; habilitado: boolean; socio: boolean; licencia: boolean }[];
  if (!fila || fila.status !== 'ACTIVE') return null;
  if (fila.habilitado) return 'HABILITADO';
  if (fila.socio) return 'SOCIO';
  if (fila.licencia) return 'LICENCIA';
  return null;
}

/** El dueño de un código, si existe (sin mirar si hoy puede referir). */
export async function duenoDelCodigo(
  m: EntityManager,
  texto: string | null | undefined,
): Promise<{ id: string; nombre: string; codigo: string } | null> {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return null;
  const [fila] = (await m.query(
    `SELECT u.id, u.full_name FROM referral_profiles r JOIN users u ON u.id = r.user_id WHERE r.code = $1`,
    [codigo],
  )) as { id: string; full_name: string }[];
  return fila ? { id: fila.id, nombre: fila.full_name, codigo } : null;
}

/**
 * Quién invita a alguien que se registra con este código: el dueño, si el programa está activo y hoy puede referir.
 * Si no, el registro sigue sin referidor (un código viejo en la cookie nunca impide registrarse). Nadie se refiere a
 * sí mismo con su documento, correo o celular: el registro ya rechaza esos datos repetidos.
 */
export async function referidorParaRegistro(
  m: EntityManager,
  texto: string | null | undefined,
): Promise<{ id: string; nombre: string } | null> {
  const dueno = await duenoDelCodigo(m, texto);
  if (!dueno) return null;
  if (!(await leerAjustesReferidos(m)).activo) return null;
  return (await viaParaReferir(m, dueno.id)) ? dueno : null;
}

export interface ComisionReferido {
  nivel: 1 | 2;
  referidorId: string;
  bp: number;
  usdCents: number;
  referidor: { nombre: string; correo: string; rol: string; direccion: boolean };
  /** En la segunda línea, el referido intermedio (por quien llegó el comprador). */
  via: string | null;
}

/**
 * Las comisiones de una venta que se aprueba: nivel 1 para quien invitó al comprador y nivel 2 para quien invitó a ese
 * referidor. Cada una se paga solo si quien la recibe puede referir hoy; que el intermedio esté activo no importa (la
 * red se fija al registrarse). Con el programa pausado, ninguna.
 */
export async function comisionesDeReferidos(
  m: EntityManager,
  compradorId: string,
  montoUsdCents: number,
): Promise<ComisionReferido[]> {
  const ajustes = await leerAjustesReferidos(m);
  if (!ajustes.activo) return [];
  const [cadena] = (await m.query(
    `SELECT c.referred_by AS primero, p.full_name AS primero_nombre, p.referred_by AS segundo
       FROM users c LEFT JOIN users p ON p.id = c.referred_by
      WHERE c.id = $1`,
    [compradorId],
  )) as { primero: string | null; primero_nombre: string | null; segundo: string | null }[];
  const candidatos = [
    { nivel: 1 as const, id: cadena?.primero ?? null, bp: ajustes.porcentajeBp, via: null },
    {
      nivel: 2 as const,
      id: cadena?.segundo ?? null,
      bp: ajustes.segundaLineaBp,
      via: cadena?.primero_nombre ?? null,
    },
  ];
  const comisiones: ComisionReferido[] = [];
  for (const c of candidatos) {
    // Nunca se cobra por las compras propias, ni aunque una corrección dejara un ciclo.
    if (!c.id || c.id === compradorId || c.bp === 0) continue;
    if (!(await viaParaReferir(m, c.id))) continue;
    const [referidor] = (await m.query(
      `SELECT u.full_name, u.email, u.role, r.usdt_address IS NOT NULL AS direccion
         FROM users u LEFT JOIN referral_profiles r ON r.user_id = u.id WHERE u.id = $1`,
      [c.id],
    )) as { full_name: string; email: string; role: string; direccion: boolean }[];
    comisiones.push({
      nivel: c.nivel,
      referidorId: c.id,
      bp: c.bp,
      usdCents: aplicarPorcentaje(montoUsdCents, c.bp),
      referidor: {
        nombre: referidor!.full_name,
        correo: referidor!.email,
        rol: referidor!.role,
        direccion: referidor!.direccion,
      },
      via: c.via,
    });
  }
  return comisiones;
}

/** El perfil de referidor de alguien; lo crea con un código nuevo si no tiene. Devuelve el código. */
export async function asegurarPerfil(m: EntityManager, usuarioId: string): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const [creado] = (await m.query(
      `INSERT INTO referral_profiles (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code`,
      [usuarioId, codigoAleatorio((n) => randomInt(n))],
    )) as { code: string }[];
    if (creado) return creado.code;
    // Choca con el perfil que ya tenía o, muy rara vez, con el código de otro: en ese caso se prueba otro.
    const [existente] = (await m.query(`SELECT code FROM referral_profiles WHERE user_id = $1`, [
      usuarioId,
    ])) as { code: string }[];
    if (existente) return existente.code;
  }
  throw new Error('No se pudo generar un código de referido único');
}

/** A dónde lleva el botón de los correos del referidor: el socio ve sus referidos en su perfil del admin. */
export function rutaReferidos(rol: string): string {
  return rol === 'ADMIN' ? '/admin/socio' : '/panel/referidos';
}
