import { aCsv } from './csv.js';

const BOM = '﻿';

describe('aCsv', () => {
  it('separa con punto y coma, lleva BOM y termina en CRLF', () => {
    expect(aCsv(['Cuenta', 'Cliente'], [['5021', 'Laura Gómez']])).toBe(
      `${BOM}Cuenta;Cliente\r\n5021;Laura Gómez\r\n`,
    );
  });

  it('pone entre comillas lo que tiene separadores, comillas o saltos de línea', () => {
    expect(aCsv(['a'], [['Gómez; "La Flaca"\notra']])).toBe(
      `${BOM}a\r\n"Gómez; ""La Flaca""\notra"\r\n`,
    );
  });

  it('neutraliza las fórmulas', () => {
    expect(aCsv(['a', 'b', 'c'], [['=HYPERLINK("x")', '-2+3+cmd|x', '@SUM(1)']])).toBe(
      `${BOM}a;b;c\r\n"'=HYPERLINK(""x"")";'-2+3+cmd|x;'@SUM(1)\r\n`,
    );
  });

  it('deja los teléfonos y los números negativos como están', () => {
    expect(aCsv(['t', 'n'], [['+57 300 123 4567', '-5']])).toBe(
      `${BOM}t;n\r\n+57 300 123 4567;-5\r\n`,
    );
  });
});
