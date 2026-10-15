import { describe, expect, it } from 'vitest';
import { claveDeCuenta, normalizarHash } from './cuentas.js';
import {
  calendarioLicencia,
  diasRestantes,
  finDePeriodo,
  tipoDeOrden,
  vencimientoSiSeAprueba,
} from './licencias.js';
import { PLANES_INICIALES } from './planes.js';

const bogota = (iso: string) => new Date(`${iso}-05:00`);
const plan = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!;

describe('finDePeriodo', () => {
  it('la semestral dura 6 meses', () => {
    expect(finDePeriodo(bogota('2026-10-09T10:00:00'), plan('SEMESTRAL'))).toEqual(
      bogota('2027-04-09T10:00:00'),
    );
  });

  it('suma el mes de obsequio si el plan lo tiene', () => {
    expect(
      finDePeriodo(bogota('2026-10-09T10:00:00'), { ...plan('SEMESTRAL'), bonusMonths: 1 }),
    ).toEqual(bogota('2027-05-09T10:00:00'));
  });

  it('la prueba dura 15 días', () => {
    expect(finDePeriodo(bogota('2026-10-03T08:00:00'), plan('PRUEBA'))).toEqual(
      bogota('2026-10-18T08:00:00'),
    );
  });
});

describe('diasRestantes', () => {
  it('cuenta días de calendario en Colombia', () => {
    expect(diasRestantes(bogota('2026-10-15T09:00:00'), bogota('2026-10-10T22:00:00'))).toBe(5);
  });

  it('no da negativos', () => {
    expect(diasRestantes(bogota('2026-10-01T00:00:00'), bogota('2026-10-10T00:00:00'))).toBe(0);
  });
});

describe('tipoDeOrden', () => {
  const mensual = plan('MENSUAL');
  const semestral = plan('SEMESTRAL');

  it('sin pagar o vencida es una licencia nueva', () => {
    expect(tipoDeOrden({ estado: 'PENDIENTE_PAGO', rangoPlan: null }, mensual)).toEqual({
      tipo: 'NUEVA',
    });
    expect(tipoDeOrden({ estado: 'VENCIDA', rangoPlan: 3 }, mensual)).toEqual({ tipo: 'NUEVA' });
  });

  it('activa o en gracia: a un plan más largo es cambio de plan; si no, renovación', () => {
    expect(tipoDeOrden({ estado: 'ACTIVA', rangoPlan: 1 }, semestral)).toEqual({
      tipo: 'CAMBIO_DE_PLAN',
    });
    expect(tipoDeOrden({ estado: 'EN_GRACIA', rangoPlan: 3 }, semestral)).toEqual({
      tipo: 'RENOVACION',
    });
    expect(tipoDeOrden({ estado: 'ACTIVA', rangoPlan: 3 }, mensual)).toEqual({
      tipo: 'RENOVACION',
    });
  });

  it('la prueba no se compra directo y una licencia suspendida no se paga', () => {
    expect(tipoDeOrden({ estado: 'PENDIENTE_PAGO', rangoPlan: null }, plan('PRUEBA'))).toEqual({
      error: 'PLAN_NO_DISPONIBLE',
    });
    expect(tipoDeOrden({ estado: 'SUSPENDIDA', rangoPlan: 1 }, mensual)).toEqual({
      error: 'LICENCIA_SUSPENDIDA',
    });
  });

  it('en prueba, cualquier plan público la completa', () => {
    expect(tipoDeOrden({ estado: 'PRUEBA', rangoPlan: 0 }, mensual)).toEqual({
      tipo: 'COMPLETAR_PRUEBA',
    });
  });
});

describe('vencimientoSiSeAprueba', () => {
  it('completar la prueba cuenta el plan desde el inicio de la prueba', () => {
    expect(
      vencimientoSiSeAprueba(
        'COMPLETAR_PRUEBA',
        {
          finActual: new Date('2026-10-18T15:00:00Z'),
          inicioPrueba: new Date('2026-10-03T15:00:00Z'),
        },
        { durationMonths: 6, bonusMonths: 0, durationDays: null },
      )?.toISOString(),
    ).toBe('2027-04-03T15:00:00.000Z');
  });

  it('una renovación suma los meses al vencimiento actual', () => {
    expect(
      vencimientoSiSeAprueba(
        'RENOVACION',
        { finActual: bogota('2026-10-15T10:00:00') },
        plan('SEMESTRAL'),
      ),
    ).toEqual(bogota('2027-04-15T10:00:00'));
  });

  it('una licencia nueva cuenta desde la aprobación: todavía no hay fecha', () => {
    expect(vencimientoSiSeAprueba('NUEVA', { finActual: null }, plan('MENSUAL'))).toBeNull();
  });
});

describe('cuentas de trading', () => {
  it('la clave ignora mayúsculas, espacios y guiones', () => {
    expect(claveDeCuenta('Just Markets', 'JustMarkets-Live', '50213847')).toBe(
      claveDeCuenta('justmarkets', 'justmarkets live', ' 50213847 '),
    );
  });

  it('acepta hashes de 64 caracteres hexadecimales', () => {
    const hash = 'A'.repeat(64);
    expect(normalizarHash(` ${hash} `)).toBe('a'.repeat(64));
    expect(normalizarHash(`0x${'b'.repeat(64)}`)).toBe('b'.repeat(64));
    expect(normalizarHash('abc')).toBeNull();
    expect(normalizarHash('g'.repeat(64))).toBeNull();
  });
});

describe('calendarioLicencia', () => {
  it('tres meses del 15 jul al 15 oct, vistos el 10 oct: 3 filas y 5 días por delante', () => {
    const filas = calendarioLicencia(
      bogota('2026-07-15T10:00:00'),
      bogota('2026-10-15T10:00:00'),
      bogota('2026-10-10T12:00:00'),
    );
    expect(filas.map((f) => f.mes)).toEqual([6, 7, 8]);
    expect(filas.map((f) => f.dias.length)).toEqual([31, 31, 30]);
    const todos = filas.flatMap((f) => f.dias);
    expect(todos.filter((d) => d === 'hoy')).toHaveLength(1);
    expect(todos.filter((d) => d === 'restante')).toHaveLength(4);
  });

  it('marca los meses de obsequio aparte (licencias viejas de 6 + 1)', () => {
    const inicio = bogota('2026-10-09T10:00:00');
    const fin = bogota('2027-05-09T10:00:00');
    const filas = calendarioLicencia(inicio, fin, bogota('2026-10-09T11:00:00'), [
      { desde: bogota('2027-04-09T10:00:00'), hasta: fin },
    ]);
    expect(filas).toHaveLength(7);
    expect(filas[6]!.dias.every((d) => d === 'obsequio')).toBe(true);
    expect(filas[0]!.dias[0]).toBe('hoy');
  });

  it('la prueba es una sola fila de 15 días', () => {
    const filas = calendarioLicencia(
      bogota('2026-10-03T09:00:00'),
      bogota('2026-10-18T09:00:00'),
      bogota('2026-10-10T09:00:00'),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]!.dias).toHaveLength(15);
    expect(filas[0]!.dias.filter((d) => d === 'usado')).toHaveLength(7);
  });
});
