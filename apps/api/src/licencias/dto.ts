import {
  CODIGO_PLAN,
  type CodigoPlan,
  LIMITES_CUENTA,
  MONEDA,
  type Moneda,
} from '@doctrader/shared';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

const { titular, broker, servidor, contrasena } = LIMITES_CUENTA;

/** Lo que identifica la cuenta en el broker. */
class DatosCuentaDto {
  @IsString()
  @Length(titular.minimo, titular.maximo, {
    message: 'Escribe el nombre del titular como aparece en tu broker.',
  })
  titular: string;

  @IsString()
  @Length(broker.minimo, broker.maximo, { message: 'Escribe el nombre de tu broker.' })
  broker: string;

  @IsString()
  @Length(servidor.minimo, servidor.maximo, { message: 'Escribe el servidor de tu cuenta.' })
  servidor: string;

  @IsString()
  @Matches(/^\s*\d{4,16}\s*$/, { message: 'Escribe solo los números de tu cuenta.' })
  numero: string;
}

export class CuentaDto extends DatosCuentaDto {
  @IsString()
  @Length(contrasena.minimo, contrasena.maximo, {
    message: 'Escribe la contraseña operativa (la de operar, no la de inversor).',
  })
  contrasenaOperativa: string;

  @IsString()
  @Length(contrasena.minimo, contrasena.maximo, {
    message: 'Escribe la contraseña de inversor (solo lectura).',
  })
  contrasenaInversor: string;
}

const largoContrasena = `La contraseña debe tener entre ${contrasena.minimo} y ${contrasena.maximo} caracteres.`;

/** Al editar, las contraseñas son opcionales: vacías, se quedan las que había. */
export class EditarCuentaDto extends DatosCuentaDto {
  @IsOptional()
  @IsString()
  @Length(contrasena.minimo, contrasena.maximo, { message: largoContrasena })
  contrasenaOperativa?: string;

  @IsOptional()
  @IsString()
  @Length(contrasena.minimo, contrasena.maximo, { message: largoContrasena })
  contrasenaInversor?: string;
}

export class NuevaOrdenDto {
  @IsUUID('all', { message: 'Elige una cuenta de trading.' })
  cuentaId: string;

  // La trimestral ya no se vende (2026-10-15); la API además revisa que el plan esté activo.
  @IsIn([CODIGO_PLAN.MENSUAL, CODIGO_PLAN.SEMESTRAL], {
    message: 'Elige una licencia.',
  })
  plan: CodigoPlan;

  @IsIn(Object.values(MONEDA), { message: 'Elige con qué pagas.' })
  moneda: Moneda;
}

export class ReportarPagoDto {
  @IsString()
  @MaxLength(200)
  hash: string;
}
