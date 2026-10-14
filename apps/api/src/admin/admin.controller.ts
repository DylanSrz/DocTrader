import { ESTADO_USUARIO, ROL } from '@doctrader/shared';
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, IsNull, Not } from 'typeorm';
import { User } from '../database/entidades/index.js';
import { Roles } from '../sesiones/decoradores.js';

/** Panel de administración. Todo lo que cuelga de `/admin` es solo para admins con sesión completa. */
@Roles(ROL.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(@InjectDataSource() private readonly fuente: DataSource) {}

  /** Cifras de la portada del panel. Crece en las etapas siguientes (pagos, licencias, por conectar…). */
  @Get('resumen')
  async resumen() {
    const usuarios = this.fuente.getRepository(User);
    const [clientes, verificados] = await Promise.all([
      usuarios.countBy({ role: ROL.CLIENTE, status: Not(ESTADO_USUARIO.BORRADO) }),
      usuarios.countBy({
        role: ROL.CLIENTE,
        status: Not(ESTADO_USUARIO.BORRADO),
        emailVerifiedAt: Not(IsNull()),
      }),
    ]);
    return { clientes, clientesVerificados: verificados };
  }
}
