import { describe, expect, it } from 'vitest';
import { correoCanonico } from './contacto.js';

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
