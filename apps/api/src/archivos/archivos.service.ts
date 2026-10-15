import { createHash, randomUUID } from 'node:crypto';
import {
  LIMITES_ADJUNTO,
  nombreDeAdjunto,
  ROL,
  TIPO_ADJUNTO,
  type TipoAdjunto,
  tipoPorContenido,
} from '@doctrader/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import sharp from 'sharp';
import type { DataSource, EntityManager } from 'typeorm';
import { PROPOSITO_ARCHIVO } from '../database/entidades/index.js';
import { errorApi } from '../seguridad/errores.js';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { SesionActiva } from '../sesiones/sesiones.service.js';
import { Almacen, ErrorAlmacen } from './almacen.js';
import { FirmaArchivos } from './firma.js';

/** El propósito de las fichas de subida. */
export const FICHA_SUBIDA = 'subida';
/** Una ficha de subida vale 30 minutos: lo que tarda alguien en escribir su mensaje. */
const VIGENCIA_SUBIDA_SEGUNDOS = 30 * 60;
/** Un archivo subido que nadie adjuntó se borra después de esto. */
const VIDA_SIN_ADJUNTAR_MS = 24 * 60 * 60_000;
/** Archivos sin adjuntar que puede tener alguien al mismo tiempo. */
const MAXIMO_SIN_ADJUNTAR = 20;

/** Lo que se muestra de un adjunto. */
export interface Adjunto {
  id: string;
  nombre: string;
  tipo: TipoAdjunto;
  tamano: number;
}

const sinAlmacen = () =>
  errorApi(
    HttpStatus.SERVICE_UNAVAILABLE,
    'ADJUNTOS_APAGADOS',
    'Por ahora no se pueden adjuntar archivos. Describe el caso con texto o escríbenos a support@doctraderpro.com.',
  );

/**
 * Vuelve a codificar una imagen: aplica la orientación y borra los metadatos (ubicación GPS, cámara). Un archivo
 * que dice ser imagen y no se puede leer se rechaza.
 */
async function limpiarImagen(bytes: Buffer, tipo: TipoAdjunto): Promise<Buffer> {
  const imagen = sharp(bytes, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate();
  if (tipo === TIPO_ADJUNTO.JPEG) return imagen.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  if (tipo === TIPO_ADJUNTO.PNG) return imagen.png({ compressionLevel: 9 }).toBuffer();
  return imagen.webp({ quality: 85 }).toBuffer();
}

/**
 * Adjuntos de soporte (`docs/SEGURIDAD.md` §7). El navegador los sube directo a la API con una ficha de 30 minutos;
 * aquí se comprueba el tipo por el contenido, se limpian las imágenes y se guardan con un nombre aleatorio. Quedan
 * sueltos hasta que un mensaje los adjunta; si no, el worker los borra al día siguiente.
 */
@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly almacen: Almacen,
    private readonly firma: FirmaArchivos,
    private readonly limites: LimitesService,
  ) {}

  get disponible(): boolean {
    return this.almacen.disponible;
  }

  /** Ficha para subir archivos desde el navegador. */
  permiso(sesion: SesionActiva) {
    if (!this.almacen.disponible) throw sinAlmacen();
    return {
      ficha: this.firma.firmar(FICHA_SUBIDA, { u: sesion.usuarioId }, VIGENCIA_SUBIDA_SEGUNDOS),
      porMensaje: LIMITES_ADJUNTO.porMensaje,
      maximoBytes: LIMITES_ADJUNTO.maximoBytes,
    };
  }

  /** El usuario de una ficha de subida, si vale y la cuenta sigue activa. */
  async usuarioDeFicha(ficha: string): Promise<string> {
    const datos = this.firma.leer(FICHA_SUBIDA, ficha);
    const filas = datos?.u
      ? ((await this.fuente.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'ACTIVE'`, [
          datos.u,
        ])) as unknown[])
      : [];
    if (!datos?.u || filas.length === 0) {
      throw errorApi(
        HttpStatus.UNAUTHORIZED,
        'FICHA_VENCIDA',
        'El permiso para subir archivos venció. Vuelve a adjuntarlos.',
      );
    }
    return datos.u;
  }

  async subir(usuarioId: string, nombreCrudo: string, bytes: Buffer): Promise<Adjunto> {
    if (!this.almacen.disponible) throw sinAlmacen();
    await this.limites.exigir(LIMITES.subidasPorUsuario, usuarioId);
    if (bytes.length === 0) {
      throw errorApi(HttpStatus.BAD_REQUEST, 'ARCHIVO_VACIO', 'El archivo está vacío.');
    }
    const tipo = tipoPorContenido(bytes.subarray(0, 16));
    if (!tipo) {
      throw errorApi(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'TIPO_NO_PERMITIDO',
        'Solo se pueden adjuntar imágenes (JPG, PNG o WEBP) o PDF.',
      );
    }
    const [{ sueltos }] = (await this.fuente.query(
      `SELECT count(*)::int AS sueltos FROM files
        WHERE owner_user_id = $1 AND ticket_message_id IS NULL AND delete_after > now()`,
      [usuarioId],
    )) as { sueltos: number }[];
    if (sueltos >= MAXIMO_SIN_ADJUNTAR) {
      throw errorApi(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADOS_ARCHIVOS',
        'Tienes muchos archivos sin enviar. Envía tu mensaje o espera un rato antes de subir más.',
      );
    }

    let final = bytes;
    if (tipo !== TIPO_ADJUNTO.PDF) {
      try {
        final = await limpiarImagen(bytes, tipo);
      } catch {
        throw errorApi(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'IMAGEN_DANADA',
          'No pudimos leer esa imagen. Toma la captura de nuevo o envíala en otro formato.',
        );
      }
      if (final.length > LIMITES_ADJUNTO.maximoBytes) {
        throw errorApi(
          HttpStatus.PAYLOAD_TOO_LARGE,
          'ARCHIVO_GRANDE',
          'Cada archivo puede pesar hasta 10 MB.',
        );
      }
    }

    const nombre = nombreDeAdjunto(nombreCrudo, tipo);
    const ahora = new Date();
    const clave = `adjuntos/${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    try {
      await this.almacen.guardar(clave, final, tipo, nombre);
    } catch (error) {
      this.logger.error(`No se pudo guardar un adjunto: ${(error as Error).message}`);
      throw errorApi(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ALMACEN_NO_RESPONDE',
        'No pudimos guardar el archivo. Intenta de nuevo en un momento.',
      );
    }
    const [fila] = (await this.fuente.query(
      `INSERT INTO files (owner_user_id, purpose, storage_key, original_name, mime, size_bytes, sha256, delete_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        usuarioId,
        PROPOSITO_ARCHIVO.TICKET_ADJUNTO,
        clave,
        nombre,
        tipo,
        final.length,
        createHash('sha256').update(final).digest(),
        new Date(Date.now() + VIDA_SIN_ADJUNTAR_MS),
      ],
    )) as { id: string }[];
    return { id: fila!.id, nombre, tipo, tamano: final.length };
  }

  /**
   * Pega archivos sueltos a un mensaje, dentro de su transacción. Solo los del mismo usuario que no se hayan usado:
   * si alguno no está, no se envía nada y se le pide adjuntarlo otra vez.
   */
  async adjuntar(
    m: EntityManager,
    datos: { usuarioId: string; mensajeId: string; ids: string[] },
  ): Promise<void> {
    const ids = [...new Set(datos.ids)];
    if (ids.length === 0) return;
    if (!this.almacen.disponible) throw sinAlmacen();
    if (ids.length > LIMITES_ADJUNTO.porMensaje) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'DEMASIADOS_ADJUNTOS',
        `Puedes adjuntar hasta ${LIMITES_ADJUNTO.porMensaje} archivos por mensaje.`,
      );
    }
    const [filas] = (await m.query(
      `UPDATE files SET ticket_message_id = $1, delete_after = NULL
        WHERE id = ANY($2::uuid[]) AND owner_user_id = $3 AND purpose = 'TICKET_ADJUNTO'
          AND ticket_message_id IS NULL AND delete_after > now()
        RETURNING id`,
      [datos.mensajeId, ids, datos.usuarioId],
    )) as [{ id: string }[], number];
    if (filas.length !== ids.length) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'ADJUNTO_NO_DISPONIBLE',
        'Uno de los archivos ya no está disponible. Quítalo y vuelve a adjuntarlo.',
      );
    }
  }

  /** Los adjuntos de varios mensajes, agrupados por mensaje. */
  async deMensajes(m: EntityManager, mensajes: string[]): Promise<Map<string, Adjunto[]>> {
    const porMensaje = new Map<string, Adjunto[]>();
    if (mensajes.length === 0) return porMensaje;
    const filas = (await m.query(
      `SELECT id, ticket_message_id, original_name, mime, size_bytes FROM files
        WHERE ticket_message_id = ANY($1::uuid[]) ORDER BY created_at`,
      [mensajes],
    )) as {
      id: string;
      ticket_message_id: string;
      original_name: string;
      mime: TipoAdjunto;
      size_bytes: number;
    }[];
    for (const f of filas) {
      const lista = porMensaje.get(f.ticket_message_id) ?? [];
      lista.push({ id: f.id, nombre: f.original_name, tipo: f.mime, tamano: f.size_bytes });
      porMensaje.set(f.ticket_message_id, lista);
    }
    return porMensaje;
  }

  /**
   * Enlace de descarga de 5 minutos. El cliente solo descarga lo de sus tickets (nunca lo de una nota interna); los
   * admins, cualquier adjunto.
   */
  async enlace(id: string, sesion: SesionActiva): Promise<{ url: string; nombre: string }> {
    const [fila] = (await this.fuente.query(
      `SELECT f.storage_key, f.mime, f.original_name, t.user_id, m.is_internal
         FROM files f
         JOIN ticket_messages m ON m.id = f.ticket_message_id
         JOIN tickets t ON t.id = m.ticket_id
        WHERE f.id = $1`,
      [id],
    )) as {
      storage_key: string;
      mime: TipoAdjunto;
      original_name: string;
      user_id: string;
      is_internal: boolean;
    }[];
    const puede =
      fila &&
      (sesion.rol === ROL.ADMIN || (fila.user_id === sesion.usuarioId && !fila.is_internal));
    if (!puede) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontramos ese archivo.');
    }
    try {
      const url = await this.almacen.enlace(fila.storage_key, fila.mime, fila.original_name);
      return { url, nombre: fila.original_name };
    } catch (error) {
      if (error instanceof ErrorAlmacen) throw sinAlmacen();
      throw error;
    }
  }

  /** Trabajo del worker: borra los archivos sueltos que nadie adjuntó. */
  async borrarVencidos(): Promise<number> {
    const filas = (await this.fuente.query(
      `SELECT id, storage_key FROM files WHERE delete_after < now() ORDER BY delete_after LIMIT 200`,
    )) as { id: string; storage_key: string }[];
    let borrados = 0;
    for (const f of filas) {
      try {
        await this.almacen.borrar(f.storage_key);
        await this.fuente.query(`DELETE FROM files WHERE id = $1`, [f.id]);
        borrados++;
      } catch (error) {
        this.logger.warn(`No se pudo borrar el archivo ${f.id}: ${(error as Error).message}`);
      }
    }
    if (borrados) this.logger.log(`Adjuntos sin usar borrados: ${borrados}`);
    return borrados;
  }
}
