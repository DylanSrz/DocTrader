import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import type { TipoAdjunto } from '@doctrader/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsClient } from 'aws4fetch';
import type { Entorno } from '../config/entorno.js';
import { FirmaArchivos } from './firma.js';

/** Un enlace de descarga vale 5 minutos (`docs/SEGURIDAD.md` §7). */
export const VIGENCIA_ENLACE_SEGUNDOS = 300;

/** El propósito de las fichas de descarga local (desarrollo). */
export const FICHA_DESCARGA = 'descarga';

/**
 * `Content-Disposition` para descargar (nunca abrir en la pestaña), con el nombre en ASCII para los navegadores
 * viejos y en UTF-8 para los demás.
 */
export function disposicion(nombre: string): string {
  const ascii =
    nombre
      .normalize('NFD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '') || 'adjunto';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/** Dónde se guardan los archivos. Detrás de esta interfaz para poder cambiar de proveedor. */
export abstract class Almacen {
  /** `false` en producción sin R2: no se aceptan adjuntos. */
  abstract readonly disponible: boolean;
  abstract guardar(clave: string, bytes: Buffer, tipo: TipoAdjunto, nombre: string): Promise<void>;
  abstract borrar(clave: string): Promise<void>;
  /** Un enlace firmado que vence en 5 minutos y descarga el archivo con su nombre. */
  abstract enlace(clave: string, tipo: TipoAdjunto, nombre: string): Promise<string>;
}

/** El almacenamiento no respondió o rechazó la operación. */
export class ErrorAlmacen extends Error {}

/** Cloudflare R2 con su API compatible con S3, firmada con SigV4 (`aws4fetch`, sin el SDK de AWS). */
export class AlmacenR2 extends Almacen {
  readonly disponible = true;
  private readonly cliente: AwsClient;
  private readonly base: string;

  constructor(cuenta: string, llave: string, secreto: string, deposito: string) {
    super();
    this.cliente = new AwsClient({
      accessKeyId: llave,
      secretAccessKey: secreto,
      service: 's3',
      region: 'auto',
    });
    this.base = `https://${cuenta}.r2.cloudflarestorage.com/${deposito}`;
  }

  private url(clave: string): URL {
    return new URL(`${this.base}/${clave.split('/').map(encodeURIComponent).join('/')}`);
  }

  private async llamar(clave: string, init: RequestInit): Promise<Response> {
    const respuesta = await this.cliente
      .fetch(this.url(clave), { ...init, signal: AbortSignal.timeout(20_000) })
      .catch((error: unknown) => {
        throw new ErrorAlmacen(`R2 no respondió: ${(error as Error).message}`);
      });
    if (!respuesta.ok && respuesta.status !== 404) {
      throw new ErrorAlmacen(`R2 respondió ${respuesta.status} (${init.method})`);
    }
    return respuesta;
  }

  async guardar(clave: string, bytes: Buffer, tipo: TipoAdjunto, nombre: string): Promise<void> {
    await this.llamar(clave, {
      method: 'PUT',
      body: new Uint8Array(bytes),
      headers: { 'content-type': tipo, 'content-disposition': disposicion(nombre) },
    });
  }

  async borrar(clave: string): Promise<void> {
    await this.llamar(clave, { method: 'DELETE' });
  }

  async enlace(clave: string, tipo: TipoAdjunto, nombre: string): Promise<string> {
    const url = this.url(clave);
    url.searchParams.set('X-Amz-Expires', String(VIGENCIA_ENLACE_SEGUNDOS));
    url.searchParams.set('response-content-disposition', disposicion(nombre));
    url.searchParams.set('response-content-type', tipo);
    const firmado = await this.cliente.sign(new Request(url, { method: 'GET' }), {
      aws: { signQuery: true },
    });
    return firmado.url;
  }
}

/**
 * Para desarrollo y pruebas: los archivos van a una carpeta local y se descargan por la API con una ficha firmada
 * de 5 minutos. Nunca se usa en producción.
 */
export class AlmacenLocal extends Almacen {
  readonly disponible = true;

  constructor(
    private readonly carpeta: string,
    private readonly api: string,
    private readonly firma: FirmaArchivos,
  ) {
    super();
  }

  /** La ruta del archivo, sin salirse de la carpeta aunque la clave traiga `..`. */
  ruta(clave: string): string {
    const ruta = resolve(this.carpeta, clave);
    if (!ruta.startsWith(resolve(this.carpeta) + sep)) throw new ErrorAlmacen('Clave no válida');
    return ruta;
  }

  async guardar(clave: string, bytes: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, bytes);
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  leer(clave: string): Promise<Buffer> {
    return readFile(this.ruta(clave));
  }

  async enlace(clave: string, tipo: TipoAdjunto, nombre: string): Promise<string> {
    const ficha = this.firma.firmar(
      FICHA_DESCARGA,
      { clave, tipo, nombre },
      VIGENCIA_ENLACE_SEGUNDOS,
    );
    return new URL(`/archivos/descarga/${ficha}`, this.api).toString();
  }
}

/** Producción sin R2: los adjuntos quedan apagados y los tickets funcionan solo con texto. */
export class SinAlmacen extends Almacen {
  readonly disponible = false;

  guardar(): Promise<void> {
    return Promise.reject(new ErrorAlmacen('No hay almacenamiento configurado'));
  }

  borrar(): Promise<void> {
    return Promise.resolve();
  }

  enlace(): Promise<string> {
    return Promise.reject(new ErrorAlmacen('No hay almacenamiento configurado'));
  }
}

/** Elige el almacenamiento según las variables: R2 si están; si no, la carpeta local (fuera de producción). */
@Injectable()
export class FabricaAlmacen {
  constructor(
    private readonly config: ConfigService<Entorno, true>,
    private readonly firma: FirmaArchivos,
  ) {}

  crear(): Almacen {
    const logger = new Logger('Archivos');
    const cuenta = this.config.get('R2_ACCOUNT_ID', { infer: true });
    const llave = this.config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secreto = this.config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    const deposito = this.config.get('R2_BUCKET', { infer: true });
    if (cuenta && llave && secreto && deposito) {
      return new AlmacenR2(cuenta, llave, secreto, deposito);
    }
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      logger.warn('Adjuntos desactivados: faltan las variables de R2');
      return new SinAlmacen();
    }
    const carpeta =
      this.config.get('ARCHIVOS_DIR', { infer: true }) ?? join(tmpdir(), 'doctrader-archivos');
    return new AlmacenLocal(
      carpeta,
      this.config.get('API_PUBLIC_URL', { infer: true }),
      this.firma,
    );
  }
}
