import { Secret, TOTP } from 'otpauth';
import {
  enlaceTotp,
  normalizarCodigoRecuperacion,
  nuevoSecretoTotp,
  nuevosCodigosRecuperacion,
  periodoDelCodigo,
} from './segundo-factor.js';

function codigoEn(secreto: string, momento: number) {
  return new TOTP({ secret: Secret.fromBase32(secreto) }).generate({ timestamp: momento });
}

describe('segundo factor', () => {
  const secreto = nuevoSecretoTotp();
  const ahora = Date.UTC(2026, 9, 14, 12, 0, 10);

  it('acepta el código actual y devuelve su periodo', () => {
    expect(periodoDelCodigo(secreto, codigoEn(secreto, ahora), ahora)).toBe(
      Math.floor(ahora / 30_000),
    );
  });

  it('acepta el código del periodo anterior, pero no uno de hace dos minutos', () => {
    expect(periodoDelCodigo(secreto, codigoEn(secreto, ahora - 30_000), ahora)).not.toBeNull();
    expect(periodoDelCodigo(secreto, codigoEn(secreto, ahora - 120_000), ahora)).toBeNull();
  });

  it('rechaza lo que no son 6 dígitos', () => {
    expect(periodoDelCodigo(secreto, '12345', ahora)).toBeNull();
    expect(periodoDelCodigo(secreto, 'abcdef', ahora)).toBeNull();
  });

  it('el enlace para el QR lleva la marca y el correo', () => {
    const enlace = enlaceTotp(secreto, 'ana@correo.co');
    expect(enlace).toMatch(/^otpauth:\/\/totp\/DocTraderPRO:ana%40correo\.co\?/);
    expect(enlace).toContain('issuer=DocTraderPRO');
  });
});

describe('códigos de recuperación', () => {
  it('son diez, distintos y fáciles de leer', () => {
    const codigos = nuevosCodigosRecuperacion();
    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    for (const codigo of codigos) expect(codigo).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/);
  });

  it('se aceptan con o sin guion y en mayúsculas', () => {
    expect(normalizarCodigoRecuperacion('K7M2P X9QRT')).toBe('k7m2p-x9qrt');
    expect(normalizarCodigoRecuperacion('k7m2px9qrt')).toBe('k7m2p-x9qrt');
    expect(normalizarCodigoRecuperacion('k7m2p')).toBeNull();
  });
});
