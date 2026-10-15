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
} from '@nestjs/common';
import { Cliente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import {
  EnviarCodigoDto,
  RechazarPruebaDto,
  SolicitarPruebaDto,
  VerificarCodigoDto,
} from './dto.js';
import { PruebaService } from './prueba.service.js';
import { TelefonoService } from './telefono.service.js';

/** La prueba desde el panel del cliente: verificar el teléfono y pedirla. */
@Roles(ROL.CLIENTE)
@Controller('prueba')
export class PruebaController {
  constructor(
    private readonly prueba: PruebaService,
    private readonly telefono: TelefonoService,
  ) {}

  @Get()
  estado(@SesionActual() sesion: SesionActiva) {
    return this.prueba.estado(sesion.usuarioId);
  }

  @Post('telefono/codigo')
  @HttpCode(HttpStatus.OK)
  enviarCodigo(
    @Body() dto: EnviarCodigoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.telefono.enviarCodigo(sesion, cliente, dto.turnstile);
  }

  @Post('telefono/verificar')
  @HttpCode(HttpStatus.OK)
  verificar(
    @Body() dto: VerificarCodigoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.telefono.verificar(sesion, cliente, dto.codigo.trim());
  }

  @Post('solicitud')
  @HttpCode(HttpStatus.OK)
  solicitar(
    @Body() dto: SolicitarPruebaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.prueba.solicitar(dto.cuentaId, { sesion, cliente });
  }
}

/** Las solicitudes de prueba en el panel de administración. */
@Roles(ROL.ADMIN)
@Controller('admin/pruebas')
export class AdminPruebasController {
  constructor(private readonly prueba: PruebaService) {}

  @Get()
  listar() {
    return this.prueba.listarAdmin();
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  async aprobar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.prueba.aprobar(id, { sesion, cliente });
    return { ok: true };
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  async rechazar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RechazarPruebaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.prueba.rechazar(id, dto.motivo.trim(), { sesion, cliente });
    return { ok: true };
  }
}
