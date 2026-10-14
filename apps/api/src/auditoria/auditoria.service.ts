import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type { Entorno } from '../config/entorno.js';
import type { AuditLog } from '../database/entidades/index.js';
import { type EntradaAuditoria, registrarEnCadena, verificarCadena } from './cadena.js';

/** Única puerta de escritura de la auditoría (ver `docs/SEGURIDAD.md` §12). */
@Injectable()
export class AuditoriaService {
  private readonly llave: Buffer;

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    config: ConfigService<Entorno, true>,
  ) {
    this.llave = Buffer.from(config.get('AUDIT_HMAC_KEY', { infer: true }), 'base64');
  }

  /**
   * Registra una acción. Si se pasa `manager`, la fila entra en esa transacción: así la acción y su auditoría se
   * guardan juntas o no se guarda ninguna.
   */
  registrar(entrada: EntradaAuditoria, manager?: EntityManager): Promise<AuditLog> {
    if (manager) return registrarEnCadena(manager, this.llave, entrada);
    return this.fuente.transaction((m) => registrarEnCadena(m, this.llave, entrada));
  }

  verificar(): Promise<{ valida: boolean; filaRota?: string }> {
    return verificarCadena(this.fuente.manager, this.llave);
  }
}
