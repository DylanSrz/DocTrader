import { describe, expect, it } from 'vitest';
import { correoCanonico, normalizarTelefono, requisitosContrasena } from './contacto.js';

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
  it('sigue la política de la API: de 10 a 128 caracteres', () => {
    expect(requisitosContrasena('').map((r) => r.cumple)).toEqual([false, false]);
    expect(requisitosContrasena('corta').map((r) => r.cumple)).toEqual([false, true]);
    expect(requisitosContrasena('una frase larga').map((r) => r.cumple)).toEqual([true, true]);
    expect(requisitosContrasena('x'.repeat(129)).map((r) => r.cumple)).toEqual([true, false]);
  });
});
