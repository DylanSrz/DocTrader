import { calcularHash } from './cadena.js';

const llave = Buffer.alloc(32, 7);
const fecha = new Date('2026-10-14T12:00:00.000Z');
const entrada = { action: 'payment.approve', actorId: 'a1', metadata: { b: 1, a: { y: 2, x: 1 } } };

describe('calcularHash', () => {
  it('da siempre el mismo hash para la misma fila', () => {
    expect(calcularHash(llave, null, entrada, fecha)).toEqual(
      calcularHash(llave, null, entrada, fecha),
    );
  });

  it('no depende del orden de las claves de metadata (Postgres las reordena al guardar jsonb)', () => {
    const reordenada = { ...entrada, metadata: { a: { x: 1, y: 2 }, b: 1 } };
    expect(calcularHash(llave, null, reordenada, fecha)).toEqual(
      calcularHash(llave, null, entrada, fecha),
    );
  });

  it('cambia si cambia cualquier dato, el hash anterior o la llave', () => {
    const base = calcularHash(llave, null, entrada, fecha);
    expect(calcularHash(llave, null, { ...entrada, action: 'payment.reject' }, fecha)).not.toEqual(
      base,
    );
    expect(calcularHash(llave, Buffer.from('otro'), entrada, fecha)).not.toEqual(base);
    expect(calcularHash(Buffer.alloc(32, 8), null, entrada, fecha)).not.toEqual(base);
    expect(calcularHash(llave, null, entrada, new Date(fecha.getTime() + 1))).not.toEqual(base);
  });
});
