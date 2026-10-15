import { LIMITES_ADJUNTO, type TipoAdjunto } from '@doctrader/shared';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorApi } from '../seguridad/errores.js';
import type { Peticion } from '../sesiones/contexto.js';
import { Publica, SesionActual } from '../sesiones/decoradores.js';
import type { SesionActiva } from '../sesiones/sesiones.service.js';
import { Almacen, AlmacenLocal, disposicion, FICHA_DESCARGA } from './almacen.js';
import { ArchivosService } from './archivos.service.js';
import { FirmaArchivos } from './firma.js';
import { ENCABEZADO_FICHA, ENCABEZADO_NOMBRE } from './rutas.js';

const muyGrande = () =>
  errorApi(HttpStatus.PAYLOAD_TOO_LARGE, 'ARCHIVO_GRANDE', 'Cada archivo puede pesar hasta 10 MB.');

/** Lee el cuerpo crudo sin pasar del máximo: lo que declara más se rechaza antes de leerlo. */
async function leerCuerpo(peticion: Peticion, maximo: number): Promise<Buffer> {
  if (Number(peticion.headers['content-length'] ?? 0) > maximo) throw muyGrande();
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of peticion as AsyncIterable<Buffer>) {
    total += parte.length;
    if (total > maximo) {
      peticion.destroy();
      throw muyGrande();
    }
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

@Controller('archivos')
export class ArchivosController {
  constructor(
    private readonly archivos: ArchivosService,
    private readonly almacen: Almacen,
    private readonly firma: FirmaArchivos,
  ) {}

  /** Permiso para subir archivos desde el navegador (la web lo pide con la sesión). */
  @Post('permiso')
  @HttpCode(HttpStatus.OK)
  permiso(@SesionActual() sesion: SesionActiva) {
    return this.archivos.permiso(sesion);
  }

  /**
   * El navegador sube un archivo (el cuerpo crudo) con la ficha del permiso. No pasa por la web porque las funciones
   * de Vercel no aceptan cuerpos de más de 4,5 MB.
   */
  @Publica()
  @Post('subir')
  @HttpCode(HttpStatus.CREATED)
  async subir(
    @Req() peticion: Peticion,
    @Headers(ENCABEZADO_FICHA) ficha: string | undefined,
    @Headers(ENCABEZADO_NOMBRE) nombre: string | undefined,
  ) {
    const usuarioId = await this.archivos.usuarioDeFicha(ficha ?? '');
    const bytes = await leerCuerpo(peticion, LIMITES_ADJUNTO.maximoBytes);
    let decodificado = 'adjunto';
    try {
      decodificado = decodeURIComponent(nombre ?? '').slice(0, 200) || 'adjunto';
    } catch {
      // Un nombre mal codificado no impide subir el archivo.
    }
    return this.archivos.subir(usuarioId, decodificado, bytes);
  }

  /** Enlace de descarga de 5 minutos; la web redirige al navegador a él. */
  @Get(':id/enlace')
  enlace(@Param('id', new ParseUUIDPipe()) id: string, @SesionActual() sesion: SesionActiva) {
    return this.archivos.enlace(id, sesion);
  }

  /** Solo en desarrollo (almacenamiento local): entrega el archivo de una ficha de descarga. */
  @Publica()
  @Get('descarga/:ficha')
  async descargar(@Param('ficha') ficha: string, @Res() respuesta: Response) {
    const datos = this.firma.leer(FICHA_DESCARGA, ficha);
    if (!(this.almacen instanceof AlmacenLocal) || !datos?.clave || !datos.tipo || !datos.nombre) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'El enlace venció o no existe.');
    }
    const bytes = await this.almacen.leer(datos.clave).catch(() => {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'El enlace venció o no existe.');
    });
    respuesta
      .status(HttpStatus.OK)
      .set({
        'content-type': datos.tipo as TipoAdjunto,
        'content-disposition': disposicion(datos.nombre),
        'cache-control': 'private, no-store',
      })
      .send(bytes);
  }
}
