import { ROL } from '@doctrader/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Cliente, ConfirmacionReciente, Roles, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { AjustesAdminService } from './ajustes-admin.service.js';
import { ClientesAdminService } from './clientes-admin.service.js';
import { CuentasService } from '../licencias/cuentas.service.js';
import { CuentasAdminService } from './cuentas-admin.service.js';
import {
  AsignacionDto,
  DatosCuentaAdminDto,
  DireccionDto,
  EnlacesDto,
  ExtenderDto,
  ListaClientesDto,
  ListaLicenciasDto,
  MotivoDto,
  MyfxbookDto,
  OperacionDto,
  PreciosDto,
} from './dto.js';
import { LicenciasAdminService } from './licencias-admin.service.js';

const uuid = new ParseUUIDPipe();

/** Listas de trabajo de Social Trader Tools: por conectar y por desconectar. */
@Roles(ROL.ADMIN)
@Controller('admin/cuentas')
export class AdminCuentasController {
  constructor(
    private readonly cuentas: CuentasAdminService,
    private readonly cuentasCliente: CuentasService,
  ) {}

  @Get()
  listas() {
    return this.cuentas.listas();
  }

  /** Acción delicada: exige el segundo factor confirmado hace menos de 5 minutos (`docs/SEGURIDAD.md` §3). */
  @Post(':id/contrasenas')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  @Header('cache-control', 'no-store')
  contrasenas(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.cuentas.verContrasenas(id, sesion, cliente);
  }

  @Post(':id/conectada')
  @HttpCode(HttpStatus.OK)
  async conectada(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.cuentas.marcarConectada(id, sesion, cliente);
    return { ok: true };
  }

  @Post(':id/desconectada')
  @HttpCode(HttpStatus.OK)
  async desconectada(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.cuentas.marcarDesconectada(id, sesion, cliente);
    return { ok: true };
  }

  /** Cambiar broker, servidor o número a pedido del cliente: con segundo factor reciente, como todo lo delicado. */
  @Put(':id/datos')
  @ConfirmacionReciente()
  datos(
    @Param('id', uuid) id: string,
    @Body() dto: DatosCuentaAdminDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.cuentasCliente.cambiarPorAdmin(id, dto, sesion, cliente);
  }

  @Put(':id/asignacion')
  async asignacion(
    @Param('id', uuid) id: string,
    @Body() dto: AsignacionDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.cuentas.asignar(id, dto, sesion, cliente);
    return { ok: true };
  }
}

/** Licencias: lista con filtros, ficha, extender días, suspender y exportar. */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminLicenciasController {
  constructor(
    private readonly licencias: LicenciasAdminService,
    private readonly clientes: ClientesAdminService,
  ) {}

  @Get('licencias')
  listar(@Query() dto: ListaLicenciasDto) {
    return this.licencias.listar(dto.filtro ?? 'todas', dto.q ?? '');
  }

  /** Exportar datos es delicado: exige el segundo factor confirmado (`docs/SEGURIDAD.md` §3). */
  @Get('licencias.csv')
  @ConfirmacionReciente()
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('cache-control', 'no-store')
  exportar(
    @Query() dto: ListaLicenciasDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.licencias.exportar(dto.filtro ?? 'todas', dto.q ?? '', sesion, cliente);
  }

  @Get('licencias/:id')
  ficha(@Param('id', uuid) id: string) {
    return this.licencias.ficha(id);
  }

  @Post('licencias/:id/extender')
  @HttpCode(HttpStatus.OK)
  extender(
    @Param('id', uuid) id: string,
    @Body() dto: ExtenderDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.licencias.extender(id, dto.dias, dto.motivo.trim(), sesion, cliente);
  }

  @Post('licencias/:id/suspender')
  @HttpCode(HttpStatus.OK)
  async suspender(
    @Param('id', uuid) id: string,
    @Body() dto: MotivoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.licencias.suspender(id, dto.motivo.trim(), sesion, cliente);
    return { ok: true };
  }

  @Post('licencias/:id/reactivar')
  @HttpCode(HttpStatus.OK)
  async reactivar(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.licencias.reactivar(id, sesion, cliente);
    return { ok: true };
  }

  @Get('clientes')
  clientesLista(@Query() dto: ListaClientesDto) {
    return this.clientes.listar(dto.filtro ?? 'todos', dto.q ?? '');
  }

  @Get('clientes/:id')
  clienteFicha(@Param('id', uuid) id: string) {
    return this.clientes.ficha(id);
  }

  @Post('clientes/:id/cedula')
  @HttpCode(HttpStatus.OK)
  @Header('cache-control', 'no-store')
  cedula(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.licencias.verCedula(id, sesion, cliente);
  }

  /** Eliminar la cuenta de un cliente que lo pidió: no se puede deshacer, por eso exige el segundo factor. */
  @Post('clientes/:id/eliminar')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  eliminar(
    @Param('id', uuid) id: string,
    @Body() dto: MotivoDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.clientes.eliminar(id, dto.motivo.trim(), sesion, cliente);
  }
}

/**
 * Ajustes y direcciones de depósito. Cambiar precios, días de gracia y direcciones exige el segundo factor
 * confirmado (`docs/SEGURIDAD.md` §3 y §5); los enlaces y las cifras de la página, no.
 */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminAjustesController {
  constructor(private readonly ajustes: AjustesAdminService) {}

  @Get('ajustes')
  leer() {
    return this.ajustes.leer();
  }

  @Put('ajustes/precios')
  @ConfirmacionReciente()
  async precios(
    @Body() dto: PreciosDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.guardarPrecios(dto, { sesion, cliente });
    return { ok: true };
  }

  @Put('ajustes/operacion')
  @ConfirmacionReciente()
  async operacion(
    @Body() dto: OperacionDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.guardarOperacion(dto, { sesion, cliente });
    return { ok: true };
  }

  /** Los enlaces que ven los clientes (Telegram, broker, correo): un cambio falso serviría para estafarlos. */
  @Put('ajustes/enlaces')
  @ConfirmacionReciente()
  async enlaces(
    @Body() dto: EnlacesDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.guardarEnlaces(
      {
        telegram: dto.telegram,
        instagram: dto.instagram,
        broker: { name: dto.brokerNombre.trim(), url: dto.brokerUrl },
      },
      dto.correoSoporte.trim().toLowerCase(),
      { sesion, cliente },
    );
    return { ok: true };
  }

  @Put('ajustes/myfxbook')
  async myfxbook(
    @Body() dto: MyfxbookDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.guardarMyfxbook(
      {
        url: dto.url,
        figures: {
          gainPercent: dto.ganancia,
          maxDrawdownPercent: dto.caidaMaxima,
          auditedSince: dto.auditadaDesde,
          asOf: dto.alDia,
        },
      },
      { sesion, cliente },
    );
    return { ok: true };
  }

  @Post('direcciones')
  @ConfirmacionReciente()
  agregar(
    @Body() dto: DireccionDto,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    return this.ajustes.agregarDireccion(dto.moneda, dto.direccion, { sesion, cliente });
  }

  /** Cancelar una dirección en espera no pide el segundo factor: es la salida de emergencia. */
  @Post('direcciones/:id/cancelar')
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.cancelarDireccion(id, { sesion, cliente });
    return { ok: true };
  }

  @Post('direcciones/:id/desactivar')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async desactivar(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.desactivarDireccion(id, { sesion, cliente });
    return { ok: true };
  }

  @Post('direcciones/:id/reactivar')
  @HttpCode(HttpStatus.OK)
  @ConfirmacionReciente()
  async reactivar(
    @Param('id', uuid) id: string,
    @SesionActual() sesion: SesionActiva,
    @Cliente() cliente: ContextoCliente,
  ) {
    await this.ajustes.reactivarDireccion(id, { sesion, cliente });
    return { ok: true };
  }
}
