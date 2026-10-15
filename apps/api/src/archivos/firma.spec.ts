import type { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';
import { disposicion } from './almacen.js';
import { FirmaArchivos } from './firma.js';

const config = {
  get: () => Buffer.alloc(32, 7).toString('base64'),
} as unknown as ConfigService<Entorno, true>;

describe('fichas de archivos', () => {
  const firma = new FirmaArchivos(config);

  it('una ficha vale para su propósito y hasta que vence', () => {
    const ficha = firma.firmar('subida', { u: 'usuario-1' }, 60);
    expect(firma.leer('subida', ficha)).toMatchObject({ u: 'usuario-1' });
    // No sirve para otra cosa.
    expect(firma.leer('descarga', ficha)).toBeNull();
    // Vencida.
    expect(firma.leer('subida', firma.firmar('subida', { u: 'x' }, -1))).toBeNull();
  });

  it('una ficha alterada no vale', () => {
    const ficha = firma.firmar('subida', { u: 'usuario-1' }, 60);
    const [cuerpo, sello] = ficha.split('.');
    const otro = Buffer.from(JSON.stringify({ u: 'usuario-2', exp: 9e9 })).toString('base64url');
    expect(firma.leer('subida', `${otro}.${sello}`)).toBeNull();
    expect(firma.leer('subida', `${cuerpo}.${sello}x`)).toBeNull();
    expect(firma.leer('subida', `${cuerpo}`)).toBeNull();
    expect(firma.leer('subida', '')).toBeNull();
  });

  it('la descarga lleva el nombre en ASCII y en UTF-8, siempre como adjunto', () => {
    expect(disposicion('envío "usdt".png')).toBe(
      `attachment; filename="envio usdt.png"; filename*=UTF-8''env%C3%ADo%20%22usdt%22.png`,
    );
    expect(disposicion('日本.pdf')).toMatch(/^attachment; filename="\.pdf"/);
  });
});
