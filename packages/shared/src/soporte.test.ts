import { describe, expect, it } from 'vitest';
import { nombreDeAdjunto, tipoPorContenido } from './soporte.js';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('adjuntos de soporte', () => {
  it('reconoce el tipo por los primeros bytes', () => {
    expect(tipoPorContenido(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(tipoPorContenido(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'image/png',
    );
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(tipoPorContenido(webp)).toBe('image/webp');
    expect(tipoPorContenido(new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('rechaza lo que no es imagen ni PDF, aunque se llame .png', () => {
    expect(
      tipoPorContenido(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBe(null);
    expect(tipoPorContenido(new TextEncoder().encode('RIFF\0\0\0\0WAVEfmt '))).toBe(null);
    expect(tipoPorContenido(bytes(0x4d, 0x5a))).toBe(null); // ejecutable de Windows
    expect(tipoPorContenido(bytes())).toBe(null);
  });

  it('limpia el nombre y le pone la extensión del tipo real', () => {
    expect(nombreDeAdjunto('C:\\Users\\laura\\captura binance.PNG', 'image/png')).toBe(
      'captura binance.png',
    );
    expect(nombreDeAdjunto('../../etc/passwd', 'application/pdf')).toBe('passwd.pdf');
    expect(nombreDeAdjunto('factura.exe', 'application/pdf')).toBe('factura.pdf');
    expect(nombreDeAdjunto('a\u202Egnp.exe', 'image/jpeg')).toBe('agnp.jpg');
    expect(nombreDeAdjunto('', 'image/webp')).toBe('adjunto.webp');
    expect(nombreDeAdjunto('x'.repeat(200) + '.jpg', 'image/jpeg')).toHaveLength(84);
  });
});
