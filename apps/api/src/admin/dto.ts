import {
  FILTROS_LICENCIAS,
  type FiltroLicencias,
  LIMITES_ADMIN,
  MONEDA,
  type Moneda,
  NIVEL_RIESGO,
  type NivelRiesgo,
} from '@doctrader/shared';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const { diasExtension, motivo, capitalUsd, notas } = LIMITES_ADMIN;

const URL_SEGURA = { protocols: ['https'], require_protocol: true };

export class ListaLicenciasDto {
  @IsOptional()
  @IsIn(FILTROS_LICENCIAS)
  filtro?: FiltroLicencias;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

/** Capital, riesgo y notas de una cuenta. Lo que no viene no se toca; `null` lo borra. */
export class AsignacionDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt({ message: 'Escribe el capital en dólares, sin decimales.' })
  @Min(capitalUsd.minimo * 100, { message: 'Escribe el capital en dólares.' })
  @Max(capitalUsd.maximo * 100, { message: 'Ese capital es demasiado alto.' })
  capitalUsdCentavos?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsIn(Object.values(NIVEL_RIESGO), { message: 'Elige el nivel de riesgo.' })
  riesgo?: NivelRiesgo | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(notas, { message: `Las notas pueden tener hasta ${notas} caracteres.` })
  notas?: string | null;
}

export class MotivoDto {
  @IsString()
  @Length(motivo.minimo, motivo.maximo, {
    message: `Escribe el motivo (entre ${motivo.minimo} y ${motivo.maximo} caracteres).`,
  })
  motivo: string;
}

export class ExtenderDto extends MotivoDto {
  @Type(() => Number)
  @IsInt({ message: 'Escribe cuántos días, sin decimales.' })
  @Min(diasExtension.minimo, { message: 'Escribe al menos 1 día.' })
  @Max(diasExtension.maximo, {
    message: `Se pueden sumar hasta ${diasExtension.maximo} días de una vez.`,
  })
  dias: number;
}

const precio = (nombre: string) => ({
  message: `Escribe el precio ${nombre} en dólares (entre 1 y 100.000).`,
});

export class PreciosDto {
  @IsInt(precio('mensual'))
  @Min(100, precio('mensual'))
  @Max(10_000_000, precio('mensual'))
  MENSUAL: number;

  @IsInt(precio('semestral'))
  @Min(100, precio('semestral'))
  @Max(10_000_000, precio('semestral'))
  SEMESTRAL: number;

  @IsInt(precio('de la prueba'))
  @Min(100, precio('de la prueba'))
  @Max(10_000_000, precio('de la prueba'))
  PRUEBA: number;

  @IsInt({ message: 'Escribe los días de la prueba.' })
  @Min(1, { message: 'La prueba dura al menos 1 día.' })
  @Max(60, { message: 'La prueba dura como máximo 60 días.' })
  diasPrueba: number;
}

export class OperacionDto {
  @IsInt({ message: 'Escribe los días de gracia.' })
  @Min(0, { message: 'Los días de gracia van de 0 a 30.' })
  @Max(30, { message: 'Los días de gracia van de 0 a 30.' })
  diasGracia: number;

  @IsInt({ message: 'Escribe los minutos.' })
  @Min(15, { message: 'La orden vale entre 15 y 240 minutos.' })
  @Max(240, { message: 'La orden vale entre 15 y 240 minutos.' })
  minutosOrden: number;

  @IsInt({ message: 'Escribe las confirmaciones de Tron.' })
  @Min(1, { message: 'Tron necesita entre 1 y 100 confirmaciones.' })
  @Max(100, { message: 'Tron necesita entre 1 y 100 confirmaciones.' })
  confirmacionesTron: number;

  @IsInt({ message: 'Escribe las confirmaciones de Bitcoin.' })
  @Min(1, { message: 'Bitcoin necesita entre 1 y 12 confirmaciones.' })
  @Max(12, { message: 'Bitcoin necesita entre 1 y 12 confirmaciones.' })
  confirmacionesBitcoin: number;
}

export class EnlacesDto {
  @IsUrl(URL_SEGURA, { message: 'Pega el enlace de Telegram (con https://).' })
  @Matches(/^https:\/\/(t\.me|telegram\.me)\//, { message: 'Debe ser un enlace de t.me.' })
  telegram: string;

  @IsUrl(URL_SEGURA, { message: 'Pega el enlace de Instagram (con https://).' })
  @Matches(/^https:\/\/(www\.)?instagram\.com\//, {
    message: 'Debe ser un enlace de instagram.com.',
  })
  instagram: string;

  @IsString()
  @Length(2, 60, { message: 'Escribe el nombre del broker.' })
  brokerNombre: string;

  @IsUrl(URL_SEGURA, { message: 'Pega el enlace completo del broker (con https://).' })
  brokerUrl: string;

  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(120)
  correoSoporte: string;
}

/** Cifras de Myfxbook que muestra la landing. Vacías (`null`) no se muestran. */
export class MyfxbookDto {
  @IsUrl(URL_SEGURA, { message: 'Pega el enlace de la cuenta en Myfxbook (con https://).' })
  @Matches(/^https:\/\/(www\.)?myfxbook\.com\//, { message: 'Debe ser un enlace de myfxbook.com.' })
  url: string;

  @ValidateIf((_o, v) => v !== null)
  @Matches(/^-?\d{1,5}(\.\d{1,2})?$/, { message: 'Escribe la ganancia como 246.68.' })
  ganancia: string | null;

  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, { message: 'Escribe la caída máxima como 18.4.' })
  caidaMaxima: string | null;

  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Elige la fecha desde la que está auditada.' })
  auditadaDesde: string | null;

  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Elige la fecha de las cifras.' })
  alDia: string | null;
}

export class DireccionDto {
  @IsIn(Object.values(MONEDA), { message: 'Elige la moneda y la red.' })
  moneda: Moneda;

  @IsString()
  @Length(25, 100, { message: 'Pega la dirección completa.' })
  @Matches(/^[A-Za-z0-9]+$/, { message: 'La dirección solo tiene letras y números.' })
  direccion: string;
}
