import { describe, expect, it } from 'vitest';
import { aUnidadesBase, aplicarPorcentaje, deUnidadesBase, formatearUsd } from './dinero.js';

describe('formatearUsd', () => {
  it('usa punto de miles y omite los centavos en cero', () => {
    expect(formatearUsd(380_200)).toBe('USD 3.802');
    expect(formatearUsd(49_900)).toBe('USD 499');
  });

  it('muestra coma decimal cuando hay centavos', () => {
    expect(formatearUsd(38_020)).toBe('USD 380,20');
  });

  it('rechaza montos que no son centavos enteros', () => {
    expect(() => formatearUsd(10.5)).toThrow();
  });
});

describe('aplicarPorcentaje', () => {
  it('calcula el 10 % de comisión en centavos', () => {
    expect(aplicarPorcentaje(380_200, 1_000)).toBe(38_020);
  });

  it('redondea al centavo', () => {
    expect(aplicarPorcentaje(12_345, 1_000)).toBe(1_235);
  });
});

describe('unidades base', () => {
  it('convierte USDT con 6 decimales', () => {
    expect(aUnidadesBase('319', 'USDT')).toBe(319_000_000n);
    expect(aUnidadesBase('300.5', 'USDT')).toBe(300_500_000n);
    expect(deUnidadesBase(319_000_000n, 'USDT')).toBe('319');
  });

  it('convierte BTC en satoshis', () => {
    expect(aUnidadesBase('0.00398', 'BTC')).toBe(398_000n);
    expect(deUnidadesBase(398_000n, 'BTC')).toBe('0.00398');
    expect(deUnidadesBase(1n, 'BTC')).toBe('0.00000001');
  });

  it('rechaza más decimales de los que admite la moneda', () => {
    expect(() => aUnidadesBase('1.1234567', 'USDT')).toThrow();
    expect(() => aUnidadesBase('abc', 'BTC')).toThrow();
  });
});
