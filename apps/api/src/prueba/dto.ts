import { LIMITES_PRUEBA } from '@doctrader/shared';
import { IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class EnviarCodigoDto {
  @IsOptional()
  @IsString()
  @MaxLength(4_096)
  turnstile?: string;
}

export class VerificarCodigoDto {
  @IsString()
  @Matches(/^\s*\d{4,8}\s*$/, { message: 'Escribe el código de 6 dígitos del SMS.' })
  codigo: string;
}

export class SolicitarPruebaDto {
  @IsUUID('all', { message: 'Elige la cuenta de trading para la prueba.' })
  cuentaId: string;
}

export class RechazarPruebaDto {
  @IsString()
  @Length(LIMITES_PRUEBA.motivoRechazo.minimo, LIMITES_PRUEBA.motivoRechazo.maximo, {
    message: 'Escribe el motivo: le llega al cliente por correo.',
  })
  motivo: string;
}
