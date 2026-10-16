import {
  deUnidadesBase,
  describirReferencia,
  type Moneda,
  NOMBRE_TEMA,
  type TemaTicket,
} from '@doctrader/shared';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';

const usd = (centavos: number) => (centavos / 100).toFixed(2);

/**
 * Copia de los datos personales del cliente (derecho de acceso, Ley 1581 de 2012). Incluye lo que la plataforma guarda
 * de él: perfil, autorizaciones, cuentas de trading, licencias, pagos y tickets. No incluye las contraseñas de las
 * cuentas (cifradas; solo las ve el administrador para conectar), las notas internas de los admins ni la cédula
 * completa: esa se pide por ticket, para que una sesión robada no la entregue.
 */
@Injectable()
export class MisDatosService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly limites: LimitesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async descargar(sesion: SesionActiva, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.descargasPorUsuario, sesion.usuarioId);
    const id = sesion.usuarioId;
    const q = <T>(sql: string) => this.fuente.query(sql, [id]) as Promise<T[]>;

    const [
      [usuario],
      autorizaciones,
      cuentas,
      licencias,
      periodos,
      pagos,
      tickets,
      mensajes,
      equipos,
    ] = await Promise.all([
      q<{
        full_name: string;
        email: string;
        phone_e164: string | null;
        cedula_last4: string | null;
        created_at: Date;
        email_verified_at: Date | null;
        totp_enabled_at: Date | null;
      }>(
        `SELECT full_name, email, phone_e164, cedula_last4, created_at, email_verified_at, totp_enabled_at
             FROM users WHERE id = $1`,
      ),
      q<{
        type: string;
        document_version: string | null;
        accepted_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT type, document_version, accepted_at, revoked_at FROM consents
            WHERE user_id = $1 ORDER BY accepted_at`,
      ),
      q<{
        id: string;
        holder_name: string;
        broker: string;
        server: string;
        account_number: string;
        connection_status: string;
        recommended_capital_usd_cents: number | null;
        risk_level: string | null;
        created_at: Date;
      }>(
        `SELECT id, holder_name, broker, server, account_number, connection_status,
                  recommended_capital_usd_cents, risk_level, created_at
             FROM trading_accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      ),
      q<{
        id: string;
        trading_account_id: string;
        plan: string | null;
        status: string;
        starts_at: Date | null;
        ends_at: Date | null;
        grace_ends_at: Date | null;
      }>(
        `SELECT l.id, l.trading_account_id, p.name AS plan, l.status, l.starts_at, l.ends_at, l.grace_ends_at
             FROM licenses l LEFT JOIN plans p ON p.id = l.plan_id
            WHERE l.user_id = $1 ORDER BY l.created_at`,
      ),
      q<{ license_id: string; kind: string; plan: string; period_start: Date; period_end: Date }>(
        `SELECT lp.license_id, lp.kind, p.name AS plan, lp.period_start, lp.period_end
             FROM license_periods lp JOIN licenses l ON l.id = lp.license_id JOIN plans p ON p.id = lp.plan_id
            WHERE l.user_id = $1 ORDER BY lp.period_start`,
      ),
      q<{
        number: string;
        trading_account_id: string;
        plan: string;
        type: string;
        amount_usd_cents: number;
        currency: Moneda;
        network: string;
        amount_base_units: string;
        deposit_address: string;
        status: string;
        tx_hash: string | null;
        created_at: Date;
        reported_at: Date | null;
        decided_at: Date | null;
        rejection_reason: string | null;
      }>(
        `SELECT o.number, o.trading_account_id, p.name AS plan, o.type, o.amount_usd_cents, o.currency,
                  o.network, o.amount_base_units, o.deposit_address, o.status, o.tx_hash, o.created_at,
                  o.reported_at, o.decided_at, o.rejection_reason
             FROM payment_orders o JOIN plans p ON p.id = o.plan_id
            WHERE o.user_id = $1 ORDER BY o.created_at`,
      ),
      q<{
        id: string;
        number: number;
        topic: TemaTicket;
        subject: string;
        status: string;
        created_at: Date;
      }>(
        `SELECT id, number, topic, subject, status, created_at FROM tickets
            WHERE user_id = $1 ORDER BY created_at`,
      ),
      // Las notas internas de los admins no son datos del cliente: no van.
      q<{ ticket_id: string; de: string; body: string; created_at: Date }>(
        `SELECT m.ticket_id, CASE WHEN m.author_id = $1 THEN 'Tú' ELSE 'DocTrader Pro' END AS de,
                  m.body, m.created_at
             FROM ticket_messages m JOIN tickets t ON t.id = m.ticket_id
            WHERE t.user_id = $1 AND NOT m.is_internal ORDER BY m.created_at`,
      ),
      q<{
        user_agent: string | null;
        last_ip: string | null;
        first_seen_at: Date;
        last_seen_at: Date;
      }>(
        `SELECT user_agent, last_ip, first_seen_at, last_seen_at FROM user_devices
            WHERE user_id = $1 ORDER BY last_seen_at DESC`,
      ),
    ]);

    const numeroCuenta = new Map(cuentas.map((c) => [c.id, c.account_number]));
    await this.auditoria.registrar({
      actorId: id,
      actorRole: sesion.rol,
      action: 'datos.descargados',
      targetType: 'user',
      targetId: id,
      ip: cliente.ip,
      userAgent: cliente.userAgent ?? null,
    });

    return {
      generadoEn: new Date().toISOString(),
      responsable: 'DocTraderPRO, Barranquilla, Colombia · support@doctraderpro.com',
      nota: 'Copia de tus datos personales en DocTraderPRO (Ley 1581 de 2012). No incluye las contraseñas de tus cuentas de trading ni tu cédula completa; para pedirla, abre un ticket.',
      perfil: usuario
        ? {
            nombre: usuario.full_name,
            correo: usuario.email,
            correoConfirmado: usuario.email_verified_at,
            telefono: usuario.phone_e164,
            cedula: usuario.cedula_last4 ? `******${usuario.cedula_last4}` : null,
            clienteDesde: usuario.created_at,
            segundoFactorActivo: usuario.totp_enabled_at !== null,
          }
        : null,
      autorizaciones: autorizaciones.map((a) => ({
        tipo: a.type,
        version: a.document_version,
        aceptadaEn: a.accepted_at,
        retiradaEn: a.revoked_at,
      })),
      cuentasDeTrading: cuentas.map((c) => ({
        titular: c.holder_name,
        broker: c.broker,
        servidor: c.server,
        numero: c.account_number,
        conexion: c.connection_status,
        capitalRecomendadoUsd:
          c.recommended_capital_usd_cents === null ? null : usd(c.recommended_capital_usd_cents),
        nivelDeRiesgo: c.risk_level,
        agregadaEn: c.created_at,
      })),
      licencias: licencias.map((l) => ({
        cuenta: numeroCuenta.get(l.trading_account_id) ?? null,
        plan: l.plan,
        estado: l.status,
        inicio: l.starts_at,
        vence: l.ends_at,
        finDeGracia: l.grace_ends_at,
        periodos: periodos
          .filter((p) => p.license_id === l.id)
          .map((p) => ({ tipo: p.kind, plan: p.plan, desde: p.period_start, hasta: p.period_end })),
      })),
      pagos: pagos.map((o) => ({
        orden: o.number,
        cuenta: numeroCuenta.get(o.trading_account_id) ?? null,
        plan: o.plan,
        tipo: o.type,
        montoUsd: usd(o.amount_usd_cents),
        monto: `${deUnidadesBase(BigInt(o.amount_base_units), o.currency)} ${o.currency}`,
        red: o.network,
        direccion: o.deposit_address,
        estado: o.status,
        referencia: o.tx_hash ? describirReferencia(o.tx_hash) : null,
        creadaEn: o.created_at,
        reportadaEn: o.reported_at,
        decididaEn: o.decided_at,
        motivoRechazo: o.rejection_reason,
      })),
      tickets: tickets.map((t) => ({
        numero: t.number,
        tema: NOMBRE_TEMA[t.topic] ?? t.topic,
        asunto: t.subject,
        estado: t.status,
        abiertoEn: t.created_at,
        mensajes: mensajes
          .filter((m) => m.ticket_id === t.id)
          .map((m) => ({ de: m.de, texto: m.body, enviadoEn: m.created_at })),
      })),
      dispositivos: equipos.map((e) => ({
        navegador: e.user_agent,
        ultimaIp: e.last_ip,
        primeraVez: e.first_seen_at,
        ultimaVez: e.last_seen_at,
      })),
    };
  }
}
