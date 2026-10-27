import { LIMITES_REFERIDOS } from '@doctrader/shared';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const rango = `Escribe un porcentaje entre ${LIMITES_REFERIDOS.minimoBp / 100} y ${LIMITES_REFERIDOS.maximoBp / 100}.`;
const minimo = `Escribe un mínimo entre USD 0 y USD ${LIMITES_REFERIDOS.minimoPagoMaxUsdCents / 100}.`;

export class DireccionCobroDto {
  @IsString()
  @MaxLength(64, { message: 'Esa no es una dirección de Tron válida.' })
  direccion: string;
}

export class AjustesReferidosDto {
  /** Puntos básicos: 2000 = 20 %. */
  @IsInt({ message: rango })
  @Min(LIMITES_REFERIDOS.minimoBp, { message: rango })
  @Max(LIMITES_REFERIDOS.maximoBp, { message: rango })
  porcentajeBp: number;

  /** Segunda línea (quienes invitan mis referidos), en puntos básicos: 500 = 5 %. */
  @IsInt({ message: rango })
  @Min(LIMITES_REFERIDOS.minimoBp, { message: rango })
  @Max(LIMITES_REFERIDOS.maximoBp, { message: rango })
  segundaLineaBp: number;

  @IsInt({ message: minimo })
  @Min(0, { message: minimo })
  @Max(LIMITES_REFERIDOS.minimoPagoMaxUsdCents, { message: minimo })
  minimoPagoUsdCents: number;

  @IsBoolean()
  activo: boolean;
}

export class PagoEnviadoDto {
  @IsString()
  @MaxLength(200, { message: 'Escribe el hash de la transacción.' })
  hash: string;
}

export class HabilitarDto {
  @IsBoolean()
  habilitado: boolean;
}

/** Habilitar por correo a alguien registrado que todavía no tiene una cuenta de trading (no tiene ficha). */
export class HabilitarPorCorreoDto extends HabilitarDto {
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(254)
  correo: string;
}

export class CorregirReferidorDto {
  /** Código del nuevo referidor; vacío o ausente para quitarlo. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @IsString()
  @Length(3, 500, { message: 'Escribe el motivo (entre 3 y 500 caracteres).' })
  motivo: string;
}

export class AnularComisionDto {
  /** 1 o 2 para anular solo esa línea; sin él, todas las comisiones sin liquidar de la orden. */
  @IsOptional()
  @IsIn([1, 2], { message: 'La línea es 1 o 2.' })
  nivel?: 1 | 2;

  @IsString()
  @Length(3, 500, { message: 'Escribe el motivo (entre 3 y 500 caracteres).' })
  motivo: string;
}
