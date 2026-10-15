import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ROL } from '@doctrader/shared';
import { Notification, User } from '../database/entidades/index.js';
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

  /** El mismo aviso a cada admin activo, con su nombre; la clave se completa con el id de cada uno. */
  async avisarAdmins(
    manager: EntityManager,
    plantilla: Plantilla,
    aviso: { clave: string; datos: Record<string, string> },
  ): Promise<void> {
    const admins = await manager.getRepository(User).findBy({ role: ROL.ADMIN, status: 'ACTIVE' });
    for (const admin of admins) {
      await this.encolar(manager, {
        usuarioId: admin.id,
        correo: admin.email,
        plantilla,
        datos: { nombre: primerNombre(admin.fullName), ...aviso.datos },
        clave: `${aviso.clave}:${admin.id}`,
      });
    }
  }
}

/** El primer nombre, para el saludo de los correos. */
export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto;
}
