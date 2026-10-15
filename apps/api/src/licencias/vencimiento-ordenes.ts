import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

/** Trabajo del worker: pasa a EXPIRADA las órdenes pendientes cuya hora pasó (`docs/MODELO-DATOS.md` §5). */
@Injectable()
export class VencimientoOrdenes {
  private readonly logger = new Logger(VencimientoOrdenes.name);

  constructor(@InjectDataSource() private readonly fuente: DataSource) {}

  async expirar(): Promise<number> {
    const [filas] = (await this.fuente.query(
      `UPDATE payment_orders SET status = 'EXPIRADA', updated_at = now()
        WHERE status = 'PENDIENTE' AND expires_at <= now() RETURNING id`,
    )) as [unknown[], number];
    if (filas.length > 0) this.logger.log(`Órdenes expiradas: ${filas.length}`);
    return filas.length;
  }
}
