import { describe, expect, it } from 'vitest';
import {
  claveDocumento,
  nombreDocumento,
  PAISES,
  tiposDocumento,
  validarDocumento,
} from './documentos.js';

const ok = (pais: string, tipo: string, numero: string) => validarDocumento(pais, tipo, numero);

describe('tiposDocumento', () => {
  it('Colombia ofrece los documentos de adultos, sin tarjeta de identidad', () => {
    const tipos = tiposDocumento('CO').map((t) => t.codigo);
    expect(tipos).toEqual(['CC', 'CE', 'PA', 'PPT', 'PEP', 'CD', 'SC']);
    expect(tipos).not.toContain('TI');
  });

  it('cada país admitido tiene al menos pasaporte o un documento nacional', () => {
    for (const { codigo } of PAISES) expect(tiposDocumento(codigo).length).toBeGreaterThan(0);
  });

  it('un país sin reglas propias usa pasaporte y documento nacional', () => {
    expect(tiposDocumento('VE').map((t) => t.codigo)).toEqual(['PA', 'DNI']);
  });

  it('un país que no está en la lista no tiene tipos', () => {
    expect(tiposDocumento('ZZ')).toEqual([]);
  });

  it('marca los documentos numéricos', () => {
    expect(tiposDocumento('CO').find((t) => t.codigo === 'CC')?.numerico).toBe(true);
    expect(tiposDocumento('CO').find((t) => t.codigo === 'PA')?.numerico).toBe(false);
  });
});

describe('validarDocumento', () => {
  it('cédula de ciudadanía: solo números, de 3 a 10 dígitos', () => {
    expect(ok('CO', 'CC', '1020304050')).toEqual({ ok: true, numero: '1020304050' });
    expect(ok('CO', 'CC', '723456')).toEqual({ ok: true, numero: '723456' });
    expect(ok('CO', 'CC', '1.020.304.050')).toMatchObject({
      ok: false,
      campo: 'documento',
      mensaje: expect.stringContaining('solo números'),
    });
    expect(ok('CO', 'CC', '1020 304')).toMatchObject({ ok: false });
    expect(ok('CO', 'CC', '102,030')).toMatchObject({ ok: false });
    expect(ok('CO', 'CC', '10203040501')).toMatchObject({ ok: false });
    expect(ok('CO', 'CC', '0123456')).toMatchObject({ ok: false });
  });

  it('cédula de extranjería: solo números', () => {
    expect(ok('CO', 'CE', '1234567')).toMatchObject({ ok: true });
    expect(ok('CO', 'CE', 'E123456')).toMatchObject({ ok: false });
  });

  it('pasaporte: letras y números, pasados a mayúsculas', () => {
    expect(ok('CO', 'PA', 'ab1234567')).toEqual({ ok: true, numero: 'AB1234567' });
    expect(ok('CO', 'PA', 'AB-123456')).toMatchObject({ ok: false });
    expect(ok('VE', 'PA', '123')).toMatchObject({ ok: false });
  });

  it('Argentina: DNI numérico de 7 u 8 dígitos (sin puntos)', () => {
    expect(ok('AR', 'DNI', '30123456')).toMatchObject({ ok: true });
    expect(ok('AR', 'DNI', '30.123.456')).toMatchObject({ ok: false });
  });

  it('México: clave de elector y CURP con su estructura', () => {
    expect(ok('MX', 'INE', 'gomlau90010109m123')).toEqual({
      ok: true,
      numero: 'GOMLAU90010109M123',
    });
    expect(ok('MX', 'INE', 'GOMLAU900101')).toMatchObject({ ok: false });
    expect(ok('MX', 'CURP', 'GORL900101MDFMSR09')).toMatchObject({ ok: true });
    expect(ok('MX', 'CURP', 'GORL900101MDFMSRA9')).toMatchObject({ ok: true });
    expect(ok('MX', 'CURP', 'GORL9001')).toMatchObject({ ok: false });
  });

  it('Estados Unidos: pasaporte de 9 caracteres y licencia alfanumérica', () => {
    expect(ok('US', 'PA', 'A12345678')).toMatchObject({ ok: true });
    expect(ok('US', 'PA', '123456789')).toMatchObject({ ok: true });
    expect(ok('US', 'PA', 'AB1234567')).toMatchObject({ ok: false });
    expect(ok('US', 'LIC', 'D1234567')).toMatchObject({ ok: true });
  });

  it('Reino Unido: pasaporte de 9 y licencia de Gran Bretaña o Irlanda del Norte', () => {
    expect(ok('GB', 'PA', '123456789')).toMatchObject({ ok: true });
    expect(ok('GB', 'LIC', 'MORGA657054SM9IJ')).toMatchObject({ ok: true });
    expect(ok('GB', 'LIC', '12345678')).toMatchObject({ ok: true });
    expect(ok('GB', 'LIC', 'MORGA657054')).toMatchObject({ ok: false });
  });

  it('país o tipo no admitidos dicen qué campo corregir', () => {
    expect(ok('ZZ', 'PA', 'AB123456')).toMatchObject({ ok: false, campo: 'documentoPais' });
    expect(ok('CO', 'TI', '1020304050')).toMatchObject({ ok: false, campo: 'documentoTipo' });
    expect(ok('CO', 'CC', '')).toMatchObject({ ok: false, campo: 'documento' });
  });
});

describe('claveDocumento y nombreDocumento', () => {
  it('la cédula colombiana conserva la clave de antes (solo el número)', () => {
    expect(claveDocumento('CO', 'CC', '1020304050')).toBe('1020304050');
    expect(claveDocumento('AR', 'DNI', '30123456')).toBe('AR:DNI:30123456');
  });

  it('nombra el documento y deja el código si no lo conoce', () => {
    expect(nombreDocumento('CO', 'CC')).toBe('Cédula de ciudadanía');
    expect(nombreDocumento('XX', 'ZZ')).toBe('ZZ');
  });
});
