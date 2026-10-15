import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { LIMITES, LimitesService } from '../seguridad/limites.service.js';
import type { Peticion } from './contexto.js';

/** Límite general por IP en toda la API, contra el abuso en volumen. Las reglas finas van en cada ruta. */
@Injectable()
export class LimiteGlobalGuard implements CanActivate {
  constructor(private readonly limites: LimitesService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest<Peticion>();
    // `/salud` debe responder aunque Redis falle, para que el monitor vea el problema.
    if (peticion.path === '/salud') return true;
    await this.limites.exigir(LIMITES.global, peticion.ipCliente);
    return true;
  }
}
