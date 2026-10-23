import { CONTEXTO } from '../acceso/acceso.service.js';
import { CONTEXTO_SECRETO_AVISO } from '../avisos/avisos.service.js';
import {
  CONTEXTO_CONTRASENA_INVERSOR,
  CONTEXTO_CONTRASENA_OPERATIVA,
} from '../licencias/cuentas.service.js';
import { COLUMNAS_CIFRADAS } from './recifrado.js';

describe('COLUMNAS_CIFRADAS', () => {
  it('usa los mismos contextos que los servicios que cifran', () => {
    expect(COLUMNAS_CIFRADAS.map((c) => c.contexto).sort()).toEqual(
      [
        CONTEXTO.cedula,
        CONTEXTO.totp,
        CONTEXTO_CONTRASENA_OPERATIVA,
        CONTEXTO_CONTRASENA_INVERSOR,
        CONTEXTO_SECRETO_AVISO,
      ].sort(),
    );
  });
});
