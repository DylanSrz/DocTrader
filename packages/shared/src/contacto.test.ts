import { describe, expect, it } from 'vitest';
import { correoCanonico, normalizarCedula, normalizarTelefono } from './contacto.js';

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

describe('normalizarCedula', () => {
  it('quita puntos, espacios y guiones', () => {
    expect(normalizarCedula('1.234.567.890')).toBe('1234567890');
    expect(normalizarCedula(' 72 345-678 ')).toBe('72345678');
  });

  it('acepta pasaportes con letras, en mayúsculas', () => {
    expect(normalizarCedula('ab123456')).toBe('AB123456');
  });

  it('rechaza lo que no parece un documento', () => {
    expect(normalizarCedula('123')).toBeNull();
    expect(normalizarCedula('12345678901234567')).toBeNull();
    expect(normalizarCedula('12#456')).toBeNull();
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
