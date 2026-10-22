import { ESTADO_USUARIO, ROL } from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import { errorApi } from '../seguridad/errores.js';
import {
  type ContextoCliente,
  type SesionActiva,
  SesionesService,
} from '../sesiones/sesiones.service.js';

/** El nombre con el que queda un cliente eliminado. Su correo es único e imposible de usar (dominio `.invalid`). */
export const NOMBRE_ELIMINADO = 'Cliente eliminado';
const correoEliminado = (id: string) => `eliminado-${id}@doctraderpro.invalid`;

/**
 * Eliminar la cuenta de un cliente que lo pida (`docs/legal/politica-datos.md` §9 y §10). Lo hace un admin desde la
 * ficha, con el segundo factor confirmado. Se borra o anonimiza todo lo personal y se conservan las órdenes y los
 * pagos (montos, fechas, hash y número de cuenta), que exigen las normas contables:
 * - El usuario queda DELETED, sin nombre, cédula, correo, teléfono, contraseña ni segundo factor; sus sesiones,
 *   dispositivos, enlaces, códigos de recuperación y correos se borran. Puede registrarse de nuevo.
 * - Sus licencias vigentes terminan (sin devolución). Sus cuentas de trading pierden el titular, las contraseñas y
 *   las notas; una cuenta conectada queda "por desconectar" para quitarla de Social Trader Tools, y las demás se
 *   marcan borradas.
 * - Sus tickets se borran, con sus adjuntos (los borra el trabajo de adjuntos).
 * - Las autorizaciones (`consents`) se conservan como prueba de lo que aceptó.
 */
@Injectable()
export class ClientesAdminService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
    private readonly sesiones: SesionesService,
  ) {}

  async eliminar(id: string, motivo: string, sesion: SesionActiva, cliente: ContextoCliente) {
    const resultado = await this.fuente.transaction(async (m) => {
      const [usuario] = (await m.query(
        `SELECT id, role, status, email, full_name FROM users WHERE id = $1 FOR UPDATE`,
        [id],
      )) as { id: string; role: string; status: string; email: string; full_name: string }[];
      if (!usuario || usuario.role !== ROL.CLIENTE) {
        throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese cliente.');
      }
      if (usuario.status === ESTADO_USUARIO.BORRADO) {
        throw errorApi(HttpStatus.CONFLICT, 'YA_ELIMINADO', 'Este cliente ya fue eliminado.');
      }
      const [revision] = (await m.query(
        `SELECT number FROM payment_orders WHERE user_id = $1 AND status = 'REPORTADA' LIMIT 1`,
        [id],
      )) as { number: string }[];
      if (revision) {
        throw errorApi(
          HttpStatus.CONFLICT,
          'PAGO_EN_REVISION',
          `El cliente tiene un pago en revisión (orden ${revision.number}). Apruébalo o recházalo antes de eliminarlo.`,
        );
      }

      // Órdenes sin pagar: ya no se pueden pagar. Licencias vigentes: terminan.
      await m.query(
        `UPDATE payment_orders SET status = 'CANCELADA', updated_at = now()
          WHERE user_id = $1 AND status = 'PENDIENTE'`,
        [id],
      );
      const [, licencias] = (await m.query(
        `UPDATE licenses SET status = 'VENCIDA', updated_at = now()
          WHERE user_id = $1 AND status IN ('ACTIVA', 'EN_GRACIA', 'SUSPENDIDA')`,
        [id],
      )) as [unknown, number];

      // Cuentas: la conectada queda por desconectar (y visible en la lista de trabajo); las demás, borradas.
      const [porDesconectar] = (await m.query(
        `UPDATE trading_accounts
            SET holder_name = $2, master_password_enc = NULL, investor_password_enc = NULL,
                passwords_purged_at = now(), internal_notes = NULL,
                connection_status = CASE connection_status
                  WHEN 'CONECTADA' THEN 'POR_DESCONECTAR'
                  WHEN 'POR_CONECTAR' THEN 'SIN_LICENCIA'
                  ELSE connection_status END,
                deleted_at = CASE WHEN connection_status IN ('CONECTADA', 'POR_DESCONECTAR')
                  THEN deleted_at ELSE coalesce(deleted_at, now()) END,
                updated_at = now()
          WHERE user_id = $1
          RETURNING connection_status`,
        [id, NOMBRE_ELIMINADO],
      )) as [{ connection_status: string }[], number];
      const desconectar = porDesconectar.filter((c) => c.connection_status === 'POR_DESCONECTAR');

      await m.query(
        `UPDATE files SET delete_after = now()
          WHERE owner_user_id = $1
             OR ticket_message_id IN (
               SELECT tm.id FROM ticket_messages tm JOIN tickets t ON t.id = tm.ticket_id WHERE t.user_id = $1
             )`,
        [id],
      );
      const [, tickets] = (await m.query(`DELETE FROM tickets WHERE user_id = $1`, [id])) as [
        unknown,
        number,
      ];
      // Referidos: su código y su dirección de cobro se borran. Los pagos ya cerrados conservan la dirección copiada,
      // para poder enviarlos; quien él invitó sigue registrado, sin referidor que pueda cobrar.
      await m.query(`DELETE FROM referral_profiles WHERE user_id = $1`, [id]);
      for (const tabla of ['user_devices', 'auth_tokens', 'recovery_codes', 'notifications']) {
        await m.query(`DELETE FROM ${tabla} WHERE user_id = $1`, [id]);
      }

      await m.query(
        `UPDATE users
            SET status = 'DELETED', deleted_at = now(), full_name = $2, email = $3, email_canonical = $3,
                email_verified_at = NULL, cedula_enc = NULL, cedula_hmac = NULL, cedula_last4 = NULL,
                document_country = NULL, document_type = NULL,
                phone_e164 = NULL, phone_verified_at = NULL, password_hash = NULL, totp_secret_enc = NULL,
                totp_enabled_at = NULL, marketing_opt_in = false, updated_at = now()
          WHERE id = $1`,
        [id, NOMBRE_ELIMINADO, correoEliminado(id)],
      );

      // El último correo va a la dirección real, sin ligarlo al usuario (que ya no tiene datos).
      await this.avisos.encolar(m, {
        usuarioId: null,
        correo: usuario.email,
        plantilla: PLANTILLA.CUENTA_ELIMINADA,
        datos: { nombre: primerNombre(usuario.full_name) },
      });
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'cliente.eliminado',
          targetType: 'user',
          targetId: id,
          // Sin datos personales: la auditoría se guarda 5 años.
          metadata: { motivo, licencias, tickets, porDesconectar: desconectar.length },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return { porDesconectar: desconectar.length };
    });
    await this.sesiones.cerrarTodas(id);
    return resultado;
  }
}
