import { LIMITES_COMISION } from '@doctrader/shared';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const rango = `Escribe un porcentaje entre ${LIMITES_COMISION.minimoBp / 100} y ${LIMITES_COMISION.maximoBp / 100}.`;

export class PorcentajeDto {
  /** Puntos básicos: 1000 = 10 %. */
  @IsInt({ message: rango })
  @Min(LIMITES_COMISION.minimoBp, { message: rango })
  @Max(LIMITES_COMISION.maximoBp, { message: rango })
  porcentajeBp: number;
}

export class PagoComisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La referencia puede tener hasta 200 caracteres.' })
  referencia?: string;
}
