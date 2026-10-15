import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

/**
 * Trabajo del worker (cada 5 minutos, `docs/MODELO-DATOS.md` §5): una licencia activa que llegó a su vencimiento
 * entra en gracia, y una en gracia que llegó al fin de la gracia vence (la de prueba vence sin gracia). Al vencer, una cuenta conectada pasa a
 * "por desconectar" y una que nunca se conectó deja de estar "por conectar".
 */
@Injectable()
export class VencimientoLicencias {
  private readonly logger = new Logger(VencimientoLicencias.name);

  constructor(@InjectDataSource() private readonly fuente: DataSource) {}

  async actualizar(): Promise<{ enGracia: number; vencidas: number }> {
    return this.fuente.transaction(async (m) => {
      const [enGracia] = (await m.query(
        `UPDATE licenses SET status = 'EN_GRACIA', updated_at = now()
          WHERE status = 'ACTIVA' AND ends_at <= now() RETURNING id`,
      )) as [unknown[], number];
      // La prueba no tiene gracia: al terminar sus días vence (`docs/MODELO-DATOS.md` §6, regla 2).
      const [vencidas] = (await m.query(
        `UPDATE licenses SET status = 'VENCIDA', updated_at = now()
          WHERE (status = 'EN_GRACIA' AND grace_ends_at <= now()) OR (status = 'PRUEBA' AND ends_at <= now())
          RETURNING trading_account_id`,
      )) as [{ trading_account_id: string }[], number];
      if (vencidas.length > 0) {
        await m.query(
          `UPDATE trading_accounts SET connection_status = CASE connection_status
              WHEN 'CONECTADA' THEN 'POR_DESCONECTAR'
              WHEN 'POR_CONECTAR' THEN 'SIN_LICENCIA'
              ELSE connection_status END,
             updated_at = now()
            WHERE id = ANY($1::uuid[])`,
          [vencidas.map((v) => v.trading_account_id)],
        );
      }
      if (enGracia.length || vencidas.length) {
        this.logger.log(`Licencias en gracia: ${enGracia.length}; vencidas: ${vencidas.length}`);
      }
      return { enGracia: enGracia.length, vencidas: vencidas.length };
    });
  }
}
