import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

/** Plazos de la política de datos (`docs/legal/politica-datos.md` §9). */
export const PLAZOS_BORRADO = {
  /** Contraseñas de trading después de desconectar una cuenta que no se renovó. */
  contrasenasDias: 90,
  /** Tickets después de cerrados. */
  ticketsMeses: 24,
  /** Registros técnicos: dispositivos, enlaces de un solo uso y correos enviados. */
  registrosMeses: 12,
} as const;

export interface ResultadoBorrado {
  contrasenas: number;
  tickets: number;
  dispositivos: number;
  enlaces: number;
  correos: number;
}

/**
 * Trabajo diario del worker: borra lo que la política de datos dice que ya no se guarda. Las órdenes, los pagos, las
 * autorizaciones y la auditoría no se tocan (se conservan por ley y como prueba). Los adjuntos de los tickets
 * borrados quedan marcados y los borra del almacenamiento el trabajo de los adjuntos, cada hora.
 */
@Injectable()
export class BorradoDatos {
  private readonly logger = new Logger(BorradoDatos.name);

  constructor(@InjectDataSource() private readonly fuente: DataSource) {}

  async ejecutar(): Promise<ResultadoBorrado> {
    const resultado = await this.fuente.transaction(async (m) => {
      // Una cuenta sin licencia vigente desde hace 90 días (desconectada, que nunca se pagó o que el cliente borró).
      const [, contrasenas] = (await m.query(
        `UPDATE trading_accounts t
            SET master_password_enc = NULL, investor_password_enc = NULL, passwords_purged_at = now(),
                updated_at = now()
          WHERE (t.master_password_enc IS NOT NULL OR t.investor_password_enc IS NOT NULL)
            AND (
              t.deleted_at IS NOT NULL
              OR (
                t.connection_status IN ('DESCONECTADA', 'SIN_LICENCIA')
                AND coalesce(t.disconnected_at, t.connection_changed_at) < now() - make_interval(days => $1)
                AND NOT EXISTS (
                  SELECT 1 FROM licenses l
                   WHERE l.trading_account_id = t.id AND l.status IN ('ACTIVA', 'EN_GRACIA', 'SUSPENDIDA')
                )
              )
            )`,
        [PLAZOS_BORRADO.contrasenasDias],
      )) as [unknown, number];

      const viejos = (await m.query(
        `SELECT id FROM tickets
          WHERE status = 'CERRADO' AND closed_at < now() - make_interval(months => $1)
          LIMIT 500`,
        [PLAZOS_BORRADO.ticketsMeses],
      )) as { id: string }[];
      const ids = viejos.map((t) => t.id);
      if (ids.length > 0) {
        await m.query(
          `UPDATE files SET delete_after = now()
            WHERE ticket_message_id IN (SELECT id FROM ticket_messages WHERE ticket_id = ANY($1::uuid[]))`,
          [ids],
        );
        await m.query(`DELETE FROM tickets WHERE id = ANY($1::uuid[])`, [ids]);
      }

      const meses = PLAZOS_BORRADO.registrosMeses;
      const [, dispositivos] = (await m.query(
        `DELETE FROM user_devices WHERE last_seen_at < now() - make_interval(months => $1)`,
        [meses],
      )) as [unknown, number];
      const [, enlaces] = (await m.query(
        `DELETE FROM auth_tokens WHERE expires_at < now() - make_interval(months => $1)`,
        [meses],
      )) as [unknown, number];
      const [, correos] = (await m.query(
        `DELETE FROM notifications
          WHERE status IN ('ENVIADA', 'FALLIDA') AND created_at < now() - make_interval(months => $1)`,
        [meses],
      )) as [unknown, number];

      return { contrasenas, tickets: ids.length, dispositivos, enlaces, correos };
    });
    if (Object.values(resultado).some((n) => n > 0)) {
      this.logger.log(`Datos vencidos borrados: ${JSON.stringify(resultado)}`);
    }
    return resultado;
  }
}
