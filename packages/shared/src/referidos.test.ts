import { describe, expect, it } from 'vitest';
import {
  ALFABETO_CODIGO,
  codigoAleatorio,
  formaDireccionTron,
  LARGO_CODIGO,
  nombreReservado,
  normalizarCodigo,
} from './referidos.js';

describe('código de referido', () => {
  it('genera 8 caracteres del alfabeto sin ambigüedades', () => {
    const valores = [0, 1, 2, 30, 29, 15, 7, 3];
    let i = 0;
    const codigo = codigoAleatorio((n) => {
      expect(n).toBe(ALFABETO_CODIGO.length);
      return valores[i++]!;
    });
    expect(codigo).toBe('ABC98SHD');
    expect(codigo).toHaveLength(LARGO_CODIGO);
    for (const letra of codigo) expect(ALFABETO_CODIGO).toContain(letra);
    expect(ALFABETO_CODIGO).not.toMatch(/[01OIL]/);
  });
  it('normaliza mayúsculas, espacios y guiones', () => {
    expect(normalizarCodigo(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizarCodigo('ABCD EFGH')).toBe('ABCDEFGH');
  });
  it('rechaza largos y letras que no van', () => {
    expect(normalizarCodigo('ABC')).toBeNull();
    expect(normalizarCodigo('ABCDEFG0')).toBeNull();
    expect(normalizarCodigo('ABCDEFGI')).toBeNull();
    expect(normalizarCodigo('')).toBeNull();
    expect(normalizarCodigo(undefined)).toBeNull();
  });
});

describe('dirección de Tron', () => {
  it('acepta la forma de una dirección TRC20', () => {
    expect(formaDireccionTron('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x')).toBe(true);
  });
  it('rechaza otras redes y textos', () => {
    expect(formaDireccionTron('1H8xfingRtsTvhnf4PosyhXvacXdGVWea1')).toBe(false);
    expect(formaDireccionTron('0x52908400098527886E0F7030069857D2E4169EE7')).toBe(false);
    expect(formaDireccionTron('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4')).toBe(false);
  });
});

describe('nombre reservado', () => {
  it('nombre de pila e inicial del apellido', () => {
    expect(nombreReservado('Patricia Owen')).toBe('Patricia O.');
    expect(nombreReservado('  ana  ')).toBe('ana');
    expect(nombreReservado('')).toBe('Cliente');
  });
});
