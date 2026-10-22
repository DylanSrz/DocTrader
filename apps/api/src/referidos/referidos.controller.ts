import { ROL } from '@doctrader/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  Cliente,
  ConfirmacionReciente,
  Publica,
  Roles,
  SesionActual,
} from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import {
  AjustesReferidosDto,
  AnularComisionDto,
  CorregirReferidorDto,
  DireccionCobroDto,
  HabilitarDto,
  PagoEnviadoDto,
} from './dto.js';
import { ReferidosService } from './referidos.service.js';

/** El programa visto por quien refiere: clientes y el socio (que es admin). */
@Controller('referidos')
export class ReferidosController {
  constructor(private readonly referidos: ReferidosService) {}

  /** "Te invitó: Patricia O." en el registro. */
  @Publica()
  @Get('codigo/:codigo')
  invitacion(@Param('codigo') codigo: string, @Cliente() cliente: ContextoCliente) {
    return this.referidos.invitacion(codigo, cliente);
  }

  @Roles(ROL.CLIENTE, ROL.ADMIN)
  @Get('mio')
  mio(@SesionActual() sesion: SesionActiva) {
    return this.referidos.vistaPropia(sesion);
  }

  /** A dónde se envía el dinero: exige confirmar la identidad hace menos de 5 minutos. */
  @Roles(ROL.CLIENTE, ROL.ADMIN)
  @Put('mio/direccion')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async direccion(
    @Body() dto: DireccionCobroDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.cambiarDireccion(dto.direccion, sesion, cliente);
    return { ok: true };
  }
}

/** Administración del programa: pagos por enviar, referidores, ajustes y correcciones. */
@Roles(ROL.ADMIN)
@Controller('admin/referidos')
export class AdminReferidosController {
  constructor(private readonly referidos: ReferidosService) {}

  @Get()
  vista() {
    return this.referidos.vistaAdmin();
  }

  @Put('ajustes')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async ajustes(
    @Body() dto: AjustesReferidosDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.cambiarAjustes(dto, sesion, cliente);
    return { ok: true };
  }

  @Post('pagos/:id/enviado')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async enviado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PagoEnviadoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.marcarEnviado(id, dto.hash, sesion, cliente);
    return { ok: true };
  }

  @Get('clientes/:id')
  ficha(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.referidos.fichaCliente(id);
  }

  @Put('clientes/:id/habilitado')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async habilitar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: HabilitarDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.habilitar(id, dto.habilitado, sesion, cliente);
    return { ok: true };
  }

  @Put('clientes/:id/referidor')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async corregir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CorregirReferidorDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.corregirReferidor(
      id,
      dto.codigo?.trim() || null,
      dto.motivo.trim(),
      sesion,
      cliente,
    );
    return { ok: true };
  }

  @Post('ordenes/:numero/anular')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async anular(
    @Param('numero') numero: string,
    @Body() dto: AnularComisionDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.referidos.anularComision(numero, dto.motivo.trim(), sesion, cliente);
    return { ok: true };
  }
}
