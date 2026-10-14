import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Notification } from '../database/entidades/index.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import type { Plantilla } from './plantillas.js';

export const CONTEXTO_SECRETO_AVISO = 'notifications.secret';

export interface NuevoAviso {
  usuarioId: string | null;
  correo: string;
  plantilla: Plantilla;
  datos?: Record<string, string>;
  /** Enlace de un solo uso: se guarda cifrado y se borra al enviar el correo. */
  secreto?: string;
  /** Si ya existe un aviso con esta clave, no se crea otro. */
  clave?: string;
}

/**
 * Deja un correo en la bandeja de salida, dentro de la transacción de la acción que lo origina. El worker lo
 * envía (ver `AvisosEnvio`), así la API no depende de que el proveedor de correo responda.
 */
@Injectable()
export class AvisosService {
  constructor(private readonly cifrado: CifradoService) {}

  async encolar(manager: EntityManager, aviso: NuevoAviso): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        userId: aviso.usuarioId,
        channel: 'EMAIL',
        recipient: aviso.correo,
        template: aviso.plantilla,
        payload: aviso.datos ?? {},
        secretEnc: aviso.secreto
          ? this.cifrado.cifrar(aviso.secreto, CONTEXTO_SECRETO_AVISO)
          : null,
        dedupeKey: aviso.clave ?? null,
      })
      .orIgnore()
      .execute();
  }
}
