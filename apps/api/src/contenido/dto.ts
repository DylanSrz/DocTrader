import { LIMITES_PREGUNTAS } from '@doctrader/shared';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, Length, ValidateNested } from 'class-validator';

export class PublicarLegalDto {
  @IsString()
  @Length(50, 200_000, { message: 'El texto está vacío o es demasiado largo.' })
  contenido: string;
}

export class PreguntaDto {
  @IsString()
  @Length(5, LIMITES_PREGUNTAS.pregunta, {
    message: `Cada pregunta debe tener entre 5 y ${LIMITES_PREGUNTAS.pregunta} caracteres.`,
  })
  pregunta: string;

  @IsString()
  @Length(5, LIMITES_PREGUNTAS.respuesta, {
    message: `Cada respuesta debe tener entre 5 y ${LIMITES_PREGUNTAS.respuesta} caracteres.`,
  })
  respuesta: string;
}

export class PreguntasDto {
  @IsArray()
  @ArrayMaxSize(LIMITES_PREGUNTAS.maximo, {
    message: `Puedes tener hasta ${LIMITES_PREGUNTAS.maximo} preguntas.`,
  })
  @ValidateNested({ each: true })
  @Type(() => PreguntaDto)
  preguntas: PreguntaDto[];
}
