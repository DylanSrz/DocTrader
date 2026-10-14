import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error con un código estable que la web entiende (`CREDENCIALES_INVALIDAS`, `CONFIRMACION_REQUERIDA`, …) y un
 * mensaje en español que se puede mostrar tal cual.
 */
export function errorApi(
  estado: HttpStatus,
  codigo: string,
  mensaje: string,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException({ codigo, mensaje, ...extra }, estado);
}

export function errorDeCampos(campos: Record<string, string>): HttpException {
  return errorApi(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Revisa los datos marcados.', {
    campos,
  });
}
