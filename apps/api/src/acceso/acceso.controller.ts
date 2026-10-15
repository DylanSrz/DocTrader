import { ESTADO_SESION } from '@doctrader/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  Cliente,
  ConfirmacionReciente,
  PermitirEstados,
  Publica,
  SesionActual,
} from '../sesiones/decoradores.js';
import {
  type ContextoCliente,
  type SesionActiva,
  SesionesService,
} from '../sesiones/sesiones.service.js';
import { AccesoService } from './acceso.service.js';
import {
  CodigoDto,
  ConfirmarDto,
  CorreoDto,
  EnlaceDto,
  IngresoDto,
  RegistroDto,
  RestablecerDto,
} from './dto.js';

const TODOS_LOS_ESTADOS = [
  ESTADO_SESION.SEGUNDO_FACTOR_PENDIENTE,
  ESTADO_SESION.SEGUNDO_FACTOR_POR_CONFIGURAR,
] as const;

/** Cuentas y acceso. Solo la web (su servidor) llama estas rutas; ver `WebMiddleware`. */
@Controller('auth')
export class AccesoController {
  constructor(
    private readonly acceso: AccesoService,
    private readonly sesiones: SesionesService,
  ) {}

  @Publica()
  @Post('registro')
  @HttpCode(HttpStatus.ACCEPTED)
  async registro(@Body() dto: RegistroDto, @Cliente() cliente: ContextoCliente) {
    await this.acceso.registrar(dto, cliente);
    return { ok: true };
  }

  @Publica()
  @Post('verificar-correo')
  @HttpCode(HttpStatus.OK)
  async verificarCorreo(@Body() dto: EnlaceDto, @Cliente() cliente: ContextoCliente) {
    await this.acceso.verificarCorreo(dto.token, cliente);
    return { ok: true };
  }

  @Publica()
  @Post('reenviar-verificacion')
  @HttpCode(HttpStatus.ACCEPTED)
  async reenviarVerificacion(@Body() dto: CorreoDto, @Cliente() cliente: ContextoCliente) {
    await this.acceso.reenviarVerificacion(dto, cliente);
    return { ok: true };
  }

  @Publica()
  @Post('ingresar')
  @HttpCode(HttpStatus.OK)
  ingresar(@Body() dto: IngresoDto, @Cliente() cliente: ContextoCliente) {
    return this.acceso.ingresar(dto, cliente);
  }

  @PermitirEstados(ESTADO_SESION.SEGUNDO_FACTOR_PENDIENTE)
  @Post('segundo-factor')
  @HttpCode(HttpStatus.OK)
  segundoFactor(
    @SesionActual() sesion: SesionActiva,
    @Body() dto: CodigoDto,
    @Cliente() cliente: ContextoCliente,
  ) {
    if (sesion.estado !== ESTADO_SESION.SEGUNDO_FACTOR_PENDIENTE) {
      throw new NotFoundException();
    }
    return this.acceso.segundoFactor(sesion, dto.codigo, cliente);
  }

  @PermitirEstados(...TODOS_LOS_ESTADOS)
  @Get('sesion')
  sesion(@SesionActual() sesion: SesionActiva) {
    return this.acceso.datosDeSesion(sesion);
  }

  @Get('perfil')
  perfil(@SesionActual() sesion: SesionActiva) {
    return this.acceso.perfil(sesion);
  }

  @PermitirEstados(...TODOS_LOS_ESTADOS)
  @Post('salir')
  @HttpCode(HttpStatus.OK)
  async salir(@SesionActual() sesion: SesionActiva) {
    await this.acceso.salir(sesion);
    return { ok: true };
  }

  @PermitirEstados(ESTADO_SESION.SEGUNDO_FACTOR_POR_CONFIGURAR)
  @Post('segundo-factor/configurar')
  @HttpCode(HttpStatus.OK)
  configurarSegundoFactor(@SesionActual() sesion: SesionActiva) {
    return this.acceso.configurarSegundoFactor(sesion);
  }

  @PermitirEstados(ESTADO_SESION.SEGUNDO_FACTOR_POR_CONFIGURAR)
  @Post('segundo-factor/activar')
  @HttpCode(HttpStatus.OK)
  activarSegundoFactor(
    @SesionActual() sesion: SesionActiva,
    @Body() dto: CodigoDto,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.acceso.activarSegundoFactor(sesion, dto.codigo, cliente);
  }

  @Post('confirmar')
  @HttpCode(HttpStatus.OK)
  confirmar(
    @SesionActual() sesion: SesionActiva,
    @Body() dto: ConfirmarDto,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.acceso.confirmar(sesion, dto, cliente);
  }

  @ConfirmacionReciente()
  @Post('segundo-factor/codigos')
  @HttpCode(HttpStatus.OK)
  regenerarCodigos(@SesionActual() sesion: SesionActiva, @Cliente() cliente: ContextoCliente) {
    return this.acceso.regenerarCodigos(sesion, cliente);
  }

  @Publica()
  @Post('recuperar')
  @HttpCode(HttpStatus.ACCEPTED)
  async recuperar(@Body() dto: CorreoDto, @Cliente() cliente: ContextoCliente) {
    await this.acceso.recuperar(dto, cliente);
    return { ok: true };
  }

  @Publica()
  @Post('restablecer')
  @HttpCode(HttpStatus.OK)
  async restablecer(@Body() dto: RestablecerDto, @Cliente() cliente: ContextoCliente) {
    await this.acceso.restablecer(dto, cliente);
    return { ok: true };
  }

  /** Sesiones abiertas del usuario, para verlas y cerrarlas desde su panel. */
  @Get('sesiones')
  async listarSesiones(@SesionActual() sesion: SesionActiva) {
    const todas = await this.sesiones.listar(sesion.usuarioId);
    return todas.map((s) => ({
      id: s.id,
      actual: s.id === sesion.id,
      navegador: s.navegador,
      ip: s.ip,
      creadaEn: s.creadaEn,
      ultimaActividad: s.ultimaActividad,
    }));
  }

  @Delete('sesiones/:id')
  async cerrarSesion(@SesionActual() sesion: SesionActiva, @Param('id') id: string) {
    if (!(await this.sesiones.cerrarPorId(sesion.usuarioId, id))) throw new NotFoundException();
    return { ok: true };
  }

  @Post('sesiones/cerrar-otras')
  @HttpCode(HttpStatus.OK)
  async cerrarOtras(@SesionActual() sesion: SesionActiva) {
    await this.sesiones.cerrarTodas(sesion.usuarioId, sesion.id);
    return { ok: true };
  }
}
