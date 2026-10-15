import {
  LIMITES_ADJUNTO,
  LIMITES_TICKET,
  PRIORIDAD_TICKET,
  type PrioridadTicket,
  TEMA_TICKET,
  type TemaTicket,
} from '@doctrader/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const { asunto, primerMensaje, mensaje, respuestaGuardada, diasCierre } = LIMITES_TICKET;

/** Los textos llegan sin espacios de sobra; los saltos de línea de en medio se respetan. */
const recortar = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

const adjuntos = () => [
  IsOptional(),
  IsArray(),
  ArrayMaxSize(LIMITES_ADJUNTO.porMensaje, {
    message: `Puedes adjuntar hasta ${LIMITES_ADJUNTO.porMensaje} archivos por mensaje.`,
  }),
  IsUUID('all', { each: true, message: 'Uno de los archivos no es válido. Vuelve a adjuntarlo.' }),
];

function aplicar(decoradores: PropertyDecorator[]): PropertyDecorator {
  return (destino, propiedad) => decoradores.forEach((d) => d(destino, propiedad));
}

export class NuevoTicketDto {
  @IsIn(Object.values(TEMA_TICKET), { message: 'Elige el tema.' })
  tema: TemaTicket;

  @recortar()
  @IsString()
  @Length(asunto.minimo, asunto.maximo, {
    message: `Escribe un asunto corto que resuma tu caso (entre ${asunto.minimo} y ${asunto.maximo} caracteres).`,
  })
  asunto: string;

  @recortar()
  @IsString()
  @Length(primerMensaje.minimo, primerMensaje.maximo, {
    message: `Cuéntanos un poco más (al menos ${primerMensaje.minimo} caracteres).`,
  })
  mensaje: string;

  @IsOptional()
  @IsUUID('all', { message: 'Elige una de tus cuentas.' })
  cuentaId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Elige una de tus órdenes.' })
  ordenId?: string;

  @aplicar(adjuntos())
  adjuntos?: string[];
}

export class MensajeDto {
  @recortar()
  @IsString()
  @Length(mensaje.minimo, mensaje.maximo, {
    message: `Escribe el mensaje antes de enviarlo (hasta ${mensaje.maximo} caracteres).`,
  })
  mensaje: string;

  @aplicar(adjuntos())
  adjuntos?: string[];
}

export class MensajeAdminDto extends MensajeDto {
  /** Nota interna: solo la ven los admins y no le llega correo al cliente. */
  @IsOptional()
  @IsBoolean()
  interna?: boolean;
}

/** Asignación y prioridad. Lo que no viene no se toca; `asignadoA: null` deja el ticket sin asignar. */
export class CambiarTicketDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID('all', { message: 'Elige a quién asignarlo.' })
  asignadoA?: string | null;

  @IsOptional()
  @IsIn(Object.values(PRIORIDAD_TICKET), { message: 'Elige la prioridad.' })
  prioridad?: PrioridadTicket;
}

export const VISTAS_BANDEJA = ['sin', 'abiertos', 'resueltos', 'todos'] as const;
export type VistaBandeja = (typeof VISTAS_BANDEJA)[number];

export class BandejaDto {
  @IsOptional()
  @IsIn(VISTAS_BANDEJA)
  vista?: VistaBandeja;

  @IsOptional()
  @IsIn(Object.values(TEMA_TICKET))
  tema?: TemaTicket;
}

export class RespuestaGuardadaDto {
  @recortar()
  @IsString()
  @Length(respuestaGuardada.titulo.minimo, respuestaGuardada.titulo.maximo, {
    message: `Escribe un título corto (entre ${respuestaGuardada.titulo.minimo} y ${respuestaGuardada.titulo.maximo} caracteres).`,
  })
  titulo: string;

  @recortar()
  @IsString()
  @Length(respuestaGuardada.cuerpo.minimo, respuestaGuardada.cuerpo.maximo, {
    message: `Escribe la respuesta (entre ${respuestaGuardada.cuerpo.minimo} y ${respuestaGuardada.cuerpo.maximo} caracteres).`,
  })
  cuerpo: string;
}

export class AjustesSoporteDto {
  @Type(() => Number)
  @IsInt({ message: 'Escribe cuántos días, sin decimales.' })
  @Min(diasCierre.minimo, { message: `Escribe al menos ${diasCierre.minimo} día.` })
  @Max(diasCierre.maximo, { message: `Escribe hasta ${diasCierre.maximo} días.` })
  diasCierre: number;
}
