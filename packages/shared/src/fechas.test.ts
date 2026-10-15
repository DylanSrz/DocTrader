import { describe, expect, it } from 'vitest';
import { sumarDias, sumarMeses } from './fechas.js';

const bogota = (iso: string) => new Date(`${iso}-05:00`);

describe('sumarMeses', () => {
  it('suma meses de calendario', () => {
    expect(sumarMeses(bogota('2026-10-03T10:00:00'), 1)).toEqual(bogota('2026-11-03T10:00:00'));
  });

  it('del 3 de octubre, 7 meses llegan al 3 de mayo', () => {
    expect(sumarMeses(bogota('2026-10-03T00:00:00'), 7)).toEqual(bogota('2027-05-03T00:00:00'));
  });

  it('usa el último día del mes cuando el día no existe', () => {
    expect(sumarMeses(bogota('2027-01-31T12:00:00'), 1)).toEqual(bogota('2027-02-28T12:00:00'));
    expect(sumarMeses(bogota('2028-01-31T12:00:00'), 1)).toEqual(bogota('2028-02-29T12:00:00'));
  });

  it('cuenta en hora de Colombia aunque en UTC ya sea otro día', () => {
    // 31 de octubre a las 23:30 en Bogotá es 1 de noviembre en UTC.
    expect(sumarMeses(bogota('2026-10-31T23:30:00'), 1)).toEqual(bogota('2026-11-30T23:30:00'));
  });
});

describe('sumarDias', () => {
  it('una prueba de 15 días desde el 3 de octubre termina el 18', () => {
    expect(sumarDias(bogota('2026-10-03T09:00:00'), 15)).toEqual(bogota('2026-10-18T09:00:00'));
  });
});
