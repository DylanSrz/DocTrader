import { ROL } from '@doctrader/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Cliente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import {
  AjustesSoporteDto,
  BandejaDto,
  CambiarTicketDto,
  MensajeAdminDto,
  MensajeDto,
  NuevoTicketDto,
  RespuestaGuardadaDto,
} from './dto.js';
import { SoporteService } from './soporte.service.js';

/** El número visible del ticket (1000, 1001, …). */
const numeroTicket = () =>
  new ParseIntPipe({
    errorHttpStatusCode: HttpStatus.NOT_FOUND,
  });

/** Los tickets del cliente: abrir, responder, marcar resuelto y reabrir (escribiendo en uno resuelto). */
@Roles(ROL.CLIENTE)
@Controller('soporte')
export class SoporteController {
  constructor(private readonly soporte: SoporteService) {}

  @Get()
  listar(@SesionActual() sesion: SesionActiva) {
    return this.soporte.listarCliente(sesion.usuarioId);
  }

  @Get(':numero')
  ver(@Param('numero', numeroTicket()) numero: number, @SesionActual() sesion: SesionActiva) {
    return this.soporte.verCliente(sesion.usuarioId, numero);
  }

  @Post()
  crear(
    @Body() dto: NuevoTicketDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.soporte.crear(dto, { sesion, cliente });
  }

  @Post(':numero/mensajes')
  @HttpCode(HttpStatus.OK)
  async responder(
    @Param('numero', numeroTicket()) numero: number,
    @Body() dto: MensajeDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.responderCliente(numero, dto, { sesion, cliente });
    return { ok: true };
  }

  @Post(':numero/resolver')
  @HttpCode(HttpStatus.OK)
  async resolver(
    @Param('numero', numeroTicket()) numero: number,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.resolverCliente(numero, { sesion, cliente });
    return { ok: true };
  }
}

/** La bandeja de soporte del panel de administración. */
@Roles(ROL.ADMIN)
@Controller('admin/soporte')
export class AdminSoporteController {
  constructor(private readonly soporte: SoporteService) {}

  @Get()
  bandeja(@Query() filtro: BandejaDto) {
    return this.soporte.bandeja(filtro.vista, filtro.tema);
  }

  @Get(':numero')
  ver(@Param('numero', numeroTicket()) numero: number) {
    return this.soporte.verAdmin(numero);
  }

  @Post(':numero/mensajes')
  @HttpCode(HttpStatus.OK)
  async responder(
    @Param('numero', numeroTicket()) numero: number,
    @Body() dto: MensajeAdminDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.responderAdmin(numero, dto, { sesion, cliente });
    return { ok: true };
  }

  @Post(':numero/resolver')
  @HttpCode(HttpStatus.OK)
  async resolver(
    @Param('numero', numeroTicket()) numero: number,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.resolverAdmin(numero, { sesion, cliente });
    return { ok: true };
  }

  @Put(':numero')
  async cambiar(
    @Param('numero', numeroTicket()) numero: number,
    @Body() dto: CambiarTicketDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.cambiar(numero, dto, { sesion, cliente });
    return { ok: true };
  }
}

/** Respuestas guardadas y el ajuste de cierre automático. */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminRespuestasController {
  constructor(private readonly soporte: SoporteService) {}

  @Get('respuestas')
  listar() {
    return this.soporte.listarRespuestas();
  }

  @Post('respuestas')
  crear(
    @Body() dto: RespuestaGuardadaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.soporte.crearRespuesta(dto, { sesion, cliente });
  }

  @Put('respuestas/:id')
  async editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RespuestaGuardadaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.editarRespuesta(id, dto, { sesion, cliente });
    return { ok: true };
  }

  @Delete('respuestas/:id')
  async borrar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.borrarRespuesta(id, { sesion, cliente });
    return { ok: true };
  }

  @Put('ajustes/soporte')
  async ajustes(
    @Body() dto: AjustesSoporteDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.soporte.guardarDiasCierre(dto.diasCierre, { sesion, cliente });
    return { ok: true };
  }
}
