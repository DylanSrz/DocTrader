import { describe, expect, it } from 'vitest';
import {
  correoCanonico,
  normalizarTelefono,
  problemaContrasena,
  requisitosContrasena,
} from './contacto.js';

describe('correoCanonico', () => {
  it('pasa a minúsculas y quita espacios', () => {
    expect(correoCanonico('  Soporte@DocTraderPro.com ')).toBe('soporte@doctraderpro.com');
  });

  it('en Gmail ignora los puntos y lo que va después de +', () => {
    expect(correoCanonico('Doc.Trader+prueba2@gmail.com')).toBe('doctrader@gmail.com');
    expect(correoCanonico('doc.trader@googlemail.com')).toBe('doctrader@gmail.com');
  });

  it('en otros dominios respeta puntos y etiquetas', () => {
    expect(correoCanonico('ana.maria+x@empresa.co')).toBe('ana.maria+x@empresa.co');
  });

  it('rechaza correos sin usuario o sin dominio', () => {
    expect(() => correoCanonico('@gmail.com')).toThrow();
    expect(() => correoCanonico('sin-arroba')).toThrow();
  });
});

describe('normalizarTelefono', () => {
  it('asume Colombia si no hay indicativo', () => {
    expect(normalizarTelefono('300 123 4567')).toBe('+573001234567');
    expect(normalizarTelefono('(300) 123-4567')).toBe('+573001234567');
  });

  it('respeta el indicativo de otro país', () => {
    expect(normalizarTelefono('+1 415 555 2671')).toBe('+14155552671');
  });

  it('rechaza números que no existen', () => {
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono('300 123')).toBeNull();
  });
});

describe('requisitosContrasena', () => {
  const cumple = (c: string) => requisitosContrasena(c).map((r) => r.cumple);

  it('largo, mayúscula, minúscula, número y carácter especial, en ese orden', () => {
    expect(requisitosContrasena('').map((r) => r.texto)).toEqual([
      'Al menos 10 caracteres',
      'Como máximo 128 caracteres',
      'Una letra mayúscula',
      'Una letra minúscula',
      'Un número',
      'Un carácter especial (por ejemplo ! # $ % & * ?)',
    ]);
    expect(cumple('')).toEqual([false, false, false, false, false, false]);
    expect(cumple('corta')).toEqual([false, true, false, true, false, false]);
    expect(cumple('Una frase larga 7!')).toEqual([true, true, true, true, true, true]);
    expect(cumple('x'.repeat(129))).toEqual([true, false, false, true, false, false]);
  });

  it('cuenta letras con tilde y la Ñ; el espacio no es un carácter especial', () => {
    expect(cumple('ÑANDÚ ágil 9')).toEqual([true, true, true, true, true, false]);
    expect(cumple('ñandú-Ágil-9')).toEqual([true, true, true, true, true, true]);
  });
});

describe('problemaContrasena', () => {
  it('acepta una contraseña que cumple todo', () => {
    expect(problemaContrasena('Una frase larga 7!')).toBeNull();
  });

  it('dice qué falta', () => {
    expect(problemaContrasena('Corta1!')).toBe('Usa al menos 10 caracteres.');
    expect(problemaContrasena('una frase larga')).toBe(
      'A la contraseña le falta una letra mayúscula, un número y un carácter especial (por ejemplo ! # $ % & * ?).',
    );
    expect(problemaContrasena('Una frase larga!')).toBe('A la contraseña le falta un número.');
    expect(problemaContrasena(`Aa1!${'x'.repeat(130)}`)).toBe('Usa como máximo 128 caracteres.');
  });
});
