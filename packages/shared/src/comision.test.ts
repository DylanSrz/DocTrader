import { describe, expect, it } from 'vitest';
import {
  formatearPorcentaje,
  periodoDeComision,
  periodosCerrados,
  periodoSiguiente,
} from './comision.js';

describe('periodos de comisión', () => {
  it('la primera quincena va del 1 al 15 en hora de Colombia', () => {
    const p = periodoDeComision(new Date('2026-10-10T12:00:00-05:00'));
    expect(p).toMatchObject({ inicio: '2026-10-01', fin: '2026-10-15' });
    expect(p.desde.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(p.hasta.toISOString()).toBe('2026-10-16T05:00:00.000Z');
  });

  it('la segunda quincena termina el último día del mes, también en febrero', () => {
    expect(periodoDeComision(new Date('2026-10-31T23:00:00-05:00')).fin).toBe('2026-10-31');
    expect(periodoDeComision(new Date('2027-02-20T10:00:00-05:00'))).toMatchObject({
      inicio: '2027-02-16',
      fin: '2027-02-28',
    });
    expect(periodoDeComision(new Date('2028-02-20T10:00:00-05:00')).fin).toBe('2028-02-29');
  });

  it('una venta a las 11 p. m. del 15 en Colombia (4 a. m. del 16 en UTC) cuenta en la primera quincena', () => {
    expect(periodoDeComision(new Date('2026-10-16T04:30:00Z')).inicio).toBe('2026-10-01');
    expect(periodoDeComision(new Date('2026-10-16T05:00:00Z')).inicio).toBe('2026-10-16');
  });

  it('la quincena siguiente cruza de mes y de año', () => {
    const diciembre = periodoDeComision(new Date('2026-12-20T12:00:00-05:00'));
    expect(periodoSiguiente(diciembre)).toMatchObject({ inicio: '2027-01-01', fin: '2027-01-15' });
  });

  it('lista las quincenas terminadas, sin la que está corriendo', () => {
    const lista = periodosCerrados(
      new Date('2026-09-03T12:00:00-05:00'),
      new Date('2026-10-20T12:00:00-05:00'),
    );
    expect(lista.map((p) => p.inicio)).toEqual(['2026-09-01', '2026-09-16', '2026-10-01']);
    expect(
      periodosCerrados(
        new Date('2026-10-17T00:00:00-05:00'),
        new Date('2026-10-20T12:00:00-05:00'),
      ),
    ).toEqual([]);
  });

  it('muestra el porcentaje con coma decimal', () => {
    expect(formatearPorcentaje(1000)).toBe('10 %');
    expect(formatearPorcentaje(1250)).toBe('12,5 %');
  });
});
