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
import { Cliente, ConfirmacionReciente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { PagoComisionDto, PorcentajeDto } from './dto.js';
import { SocioService } from './socio.service.js';

/** Perfil del socio: lo ven los dos admins; el porcentaje solo lo cambia el socio. */
@Roles(ROL.ADMIN)
@Controller('admin/socio')
export class AdminSocioController {
  constructor(private readonly socio: SocioService) {}

  @Get()
  vista(@SesionActual() sesion: SesionActiva) {
    return this.socio.vista(sesion);
  }

  /** Cambia dinero de aquí en adelante: exige el segundo factor confirmado hace menos de 5 minutos. */
  @Put('comision')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async comision(
    @Body() dto: PorcentajeDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.socio.cambiarPorcentaje(dto.porcentajeBp, sesion, cliente);
    return { ok: true };
  }

  @Post('liquidaciones/:id/pagada')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async pagada(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PagoComisionDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.socio.marcarPagada(id, dto.referencia, sesion, cliente);
    return { ok: true };
  }
}
