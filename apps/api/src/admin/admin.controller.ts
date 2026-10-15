import { ROL } from '@doctrader/shared';
import { Controller, Get } from '@nestjs/common';
import { Roles } from '../sesiones/decoradores.js';
import { ResumenAdminService } from './resumen.service.js';

/** Panel de administración. Todo lo que cuelga de `/admin` es solo para admins con sesión completa. */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly resumen: ResumenAdminService) {}

  /** La portada del panel ("Hoy"). */
  @Get('resumen')
  leerResumen() {
    return this.resumen.resumen();
  }
}
