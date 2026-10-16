import { Controller, Get, Header } from '@nestjs/common';
import { Cliente, SesionActual } from '../sesiones/decoradores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { MisDatosService } from './mis-datos.service.js';

/** "Descargar mis datos" desde Mi perfil. */
@Controller('privacidad')
export class MisDatosController {
  constructor(private readonly misDatos: MisDatosService) {}

  @Get('mis-datos')
  @Header('cache-control', 'no-store')
  descargar(@SesionActual() sesion: SesionActiva, @Cliente() cliente: ContextoCliente) {
    return this.misDatos.descargar(sesion, cliente);
  }
}
