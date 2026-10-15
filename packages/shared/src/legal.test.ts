import { describe, expect, it } from 'vitest';
import { textoPublicoDeBorrador } from './legal.js';

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
