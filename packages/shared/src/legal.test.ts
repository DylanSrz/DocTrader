import { describe, expect, it } from 'vitest';
import { textoPublicoDeBorrador, sustituirPrecios } from './legal.js';

describe('textoPublicoDeBorrador', () => {
  const borrador = [
    '# Aviso de riesgo',
    '',
    '> Borrador del 2026-10-14. Conviene que lo revise un abogado.',
    '> Segunda línea de la nota.',
    '',
    '**Versión 1.0**',
    '',
    '## 1. Puedes perder dinero',
    '',
    'Texto público.',
    '',
    '---',
    '',
    '**Versión corta** (para el pie de página):',
  ].join('\n');

  it('quita el título, la nota interna y lo que va después de la línea final', () => {
    expect(textoPublicoDeBorrador(borrador)).toBe(
      '**Versión 1.0**\n\n## 1. Puedes perder dinero\n\nTexto público.',
    );
  });

  it('deja intacto un texto sin esas partes', () => {
    expect(textoPublicoDeBorrador('## 1. Algo\n\nTexto.')).toBe('## 1. Algo\n\nTexto.');
  });
});

describe('sustituirPrecios', () => {
  const planes = [
    {
      codigo: 'MENSUAL',
      nombre: 'Mensual',
      meses: 1,
      mesesObsequio: 0,
      precioUsdCentavos: 12_500,
      publico: true,
    },
    {
      codigo: 'SEMESTRAL',
      nombre: 'Semestral',
      meses: 6,
      mesesObsequio: 0,
      precioUsdCentavos: 49_900,
      publico: true,
    },
    {
      codigo: 'TRIMESTRAL',
      nombre: 'Trimestral',
      meses: 3,
      mesesObsequio: 0,
      precioUsdCentavos: 31_900,
      publico: false,
    },
  ];

  it('arma la tabla con los planes a la venta y sus precios actuales', () => {
    expect(sustituirPrecios('Planes:\n\n{{precios}}\n\nFin.', planes)).toBe(
      'Planes:\n\n| Plan | Duración | Precio |\n|---|---|---|\n| Mensual | 1 mes | USD 125 |\n| Semestral | 6 meses | USD 499 |\n\nFin.',
    );
  });

  it('pone el precio de un plan y deja el marcador de uno que no existe', () => {
    expect(sustituirPrecios('Cuesta {{precio:MENSUAL}}; {{precio:ANUAL}}.', planes)).toBe(
      'Cuesta USD 125; {{precio:ANUAL}}.',
    );
  });
});
