import { CONTRASENA_MAXIMO, CONTRASENA_MINIMO } from '@doctrader/shared';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const contrasena = `La contraseña debe tener entre ${CONTRASENA_MINIMO} y ${CONTRASENA_MAXIMO} caracteres.`;

export class RegistroDto {
  @IsString()
  @Length(3, 120, { message: 'Escribe tu nombre completo.' })
  // Solo letras y signos de nombres: el nombre aparece en los correos, y un "nombre" con un dominio o un enlace
  // serviría para suplantar a la marca.
  @Matches(/^\p{L}[\p{L}\p{M}' -]*$/u, {
    message: 'Escribe tu nombre solo con letras, sin números ni símbolos.',
  })
  nombre: string;

  @IsString()
  @Length(5, 20, { message: 'Escribe tu número de cédula.' })
  cedula: string;

  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(254)
  correo: string;

  @IsString()
  @Length(7, 25, { message: 'Escribe tu número de celular.' })
  telefono: string;

  @IsString()
  @Length(CONTRASENA_MINIMO, CONTRASENA_MAXIMO, { message: contrasena })
  contrasena: string;

  @Equals(true, { message: 'Debes aceptar los términos de la licencia.' })
  aceptaTerminos: boolean;

  @Equals(true, { message: 'Debes autorizar el tratamiento de tus datos.' })
  aceptaDatos: boolean;

  @Equals(true, { message: 'Debes leer y aceptar el aviso de riesgo.' })
  aceptaRiesgo: boolean;

  @IsOptional()
  @IsBoolean()
  aceptaMercadeo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  turnstile?: string;
}

export class IngresoDto {
  @IsString()
  @MaxLength(254)
  correo: string;

  @IsString()
  @MaxLength(CONTRASENA_MAXIMO)
  contrasena: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  turnstile?: string;

  /** Identificador aleatorio del navegador (cookie de la web), para avisar de ingresos desde uno nuevo. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/)
  dispositivo?: string;
}

export class CodigoDto {
  /** Seis dígitos de la app, o un código de recuperación (`abcde-fghij`). */
  @IsString()
  @Length(6, 20, { message: 'Escribe el código.' })
  codigo: string;
}

export class ConfirmarDto {
  @IsOptional()
  @IsString()
  @Length(6, 20)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTRASENA_MAXIMO)
  contrasena?: string;
}

export class CorreoDto {
  @IsString()
  @MaxLength(254)
  correo: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  turnstile?: string;
}

export class EnlaceDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'El enlace no es válido.' })
  token: string;
}

export class RestablecerDto extends EnlaceDto {
  @IsString()
  @Length(CONTRASENA_MINIMO, CONTRASENA_MAXIMO, { message: contrasena })
  contrasena: string;
}
