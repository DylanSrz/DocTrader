import { describe, expect, it } from 'vitest';
import { numeroParecido, titularParecido } from './prueba.js';

describe('señales de la prueba', () => {
  it('titular parecido: dos palabras en común, sin importar tildes ni orden', () => {
    expect(titularParecido('Laura Gómez Restrepo', 'GOMEZ RESTREPO, Laura')).toBe(true);
    expect(titularParecido('Juan Pablo Mejía', 'Carolina Mejía Ruiz')).toBe(false);
    expect(titularParecido('Juan Pablo Mejía', 'Juan Mejia')).toBe(true);
    expect(titularParecido('Andrés', 'andres')).toBe(true);
    expect(titularParecido('', 'Andrés')).toBe(false);
  });

  it('número parecido: una o dos ediciones en números de 6 o más dígitos', () => {
    expect(numeroParecido('7718260', '7718206')).toBe(true);
    expect(numeroParecido('50288813', '50288814')).toBe(true);
    expect(numeroParecido('50288813', '50288813')).toBe(false);
    expect(numeroParecido('50288813', '61177702')).toBe(false);
    expect(numeroParecido('12345', '12346')).toBe(false);
  });
});
