import { ROL } from '@doctrader/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Cliente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { CuentasService } from './cuentas.service.js';
import { CuentaDto, EditarCuentaDto, NuevaOrdenDto, ReportarPagoDto } from './dto.js';
import { OrdenesService } from './ordenes.service.js';

/** Las cuentas de trading del cliente, cada una con su licencia. */
@Roles(ROL.CLIENTE)
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  @Get()
  listar(@SesionActual() sesion: SesionActiva) {
    return this.cuentas.listar(sesion.usuarioId);
  }

  @Get(':id')
  una(@Param('id') id: string, @SesionActual() sesion: SesionActiva) {
    return this.cuentas.una(sesion.usuarioId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  agregar(
    @Body() dto: CuentaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.cuentas.agregar(dto, sesion, cliente);
  }

  @Put(':id')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarCuentaDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.cuentas.editar(id, dto, sesion, cliente);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  quitar(
    @Param('id') id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.cuentas.quitar(id, sesion, cliente);
  }
}

/** Órdenes de pago del cliente. */
@Roles(ROL.CLIENTE)
@Controller('ordenes')
export class OrdenesController {
  constructor(private readonly ordenes: OrdenesService) {}

  @Get()
  listar(@SesionActual() sesion: SesionActiva) {
    return this.ordenes.listar(sesion.usuarioId);
  }

  @Get(':numero')
  una(@Param('numero') numero: string, @SesionActual() sesion: SesionActiva) {
    return this.ordenes.obtener(sesion.usuarioId, numero);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(
    @Body() dto: NuevaOrdenDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.ordenes.crear(dto, sesion, cliente);
  }

  @Post(':numero/reportar')
  @HttpCode(HttpStatus.OK)
  reportar(
    @Param('numero') numero: string,
    @Body() dto: ReportarPagoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.ordenes.reportar(numero, dto.hash, sesion, cliente);
  }

  @Post(':numero/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @Param('numero') numero: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.ordenes.cancelar(numero, sesion, cliente);
  }
}
