import { ROL, type TipoDocumentoLegal } from '@doctrader/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  Cliente,
  ConfirmacionReciente,
  Publica,
  Roles,
  SesionActual,
} from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { ContenidoService } from './contenido.service.js';
import { PreguntasDto, PublicarLegalDto } from './dto.js';

/** Lo que muestra la página pública. La web lo guarda en caché y lo vuelve a pedir cuando el admin cambia algo. */
@Publica()
@Controller('publico')
export class PublicoController {
  constructor(private readonly contenido: ContenidoService) {}

  @Get('landing')
  landing() {
    return this.contenido.landing();
  }

  @Get('legal/:ruta')
  legal(@Param('ruta') ruta: string) {
    return this.contenido.legalPorRuta(ruta);
  }
}

/** Textos legales y preguntas frecuentes, desde el panel de administración. */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminContenidoController {
  constructor(private readonly contenido: ContenidoService) {}

  @Get('legal')
  legales() {
    return this.contenido.listarLegales();
  }

  /** Publicar un texto legal es una acción delicada: exige confirmar con el segundo factor. */
  @ConfirmacionReciente()
  @Post('legal/:tipo')
  @HttpCode(HttpStatus.CREATED)
  publicarLegal(
    @Param('tipo') tipo: string,
    @Body() dto: PublicarLegalDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.contenido.publicarLegal(tipo as TipoDocumentoLegal, dto.contenido, sesion, cliente);
  }

  @Get('preguntas')
  preguntas() {
    return this.contenido.preguntas();
  }

  @Put('preguntas')
  guardarPreguntas(
    @Body() dto: PreguntasDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.contenido.guardarPreguntas(dto.preguntas, sesion, cliente);
  }
}
