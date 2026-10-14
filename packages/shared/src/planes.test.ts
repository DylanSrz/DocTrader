import { describe, expect, it } from 'vitest';
import { PLANES_INICIALES, diferenciaParaCompletar } from './planes.js';

const precio = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!.priceUsdCents;

describe('planes iniciales', () => {
  it('tienen los precios acordados con Argemiro', () => {
    expect(precio('MENSUAL')).toBe(12_000);
    expect(precio('TRIMESTRAL')).toBe(31_900);
    expect(precio('SEMESTRAL')).toBe(49_900);
    expect(precio('PRUEBA')).toBe(5_000);
  });

  it('la semestral dura 6 meses más 1 de obsequio', () => {
    const semestral = PLANES_INICIALES.find((p) => p.code === 'SEMESTRAL')!;
    expect(semestral.durationMonths! + semestral.bonusMonths).toBe(7);
  });

  it('la prueba no se compra directo', () => {
    expect(PLANES_INICIALES.find((p) => p.code === 'PRUEBA')!.isPublic).toBe(false);
  });
});

describe('diferenciaParaCompletar', () => {
  it('cobra USD 70, 269 o 449 según el plan', () => {
    const prueba = precio('PRUEBA');
    expect(diferenciaParaCompletar(precio('MENSUAL'), prueba)).toBe(7_000);
    expect(diferenciaParaCompletar(precio('TRIMESTRAL'), prueba)).toBe(26_900);
    expect(diferenciaParaCompletar(precio('SEMESTRAL'), prueba)).toBe(44_900);
  });
});
