import { aCentavos, centavosATexto, elegirPrecio, satoshisPara } from './precio-btc.js';

describe('precio de BTC', () => {
  it('convierte los precios de los proveedores a centavos', () => {
    expect(aCentavos('67234.12000000')).toBe(6_723_412n);
    expect(aCentavos('67234.125')).toBe(6_723_413n);
    expect(aCentavos(67234)).toBe(6_723_400n);
    expect(aCentavos('abc')).toBeNull();
    expect(aCentavos('0')).toBeNull();
  });

  it('usa Binance si los dos coinciden dentro del 1 %', () => {
    expect(elegirPrecio(10_000_000n, 10_090_000n)).toEqual({
      ok: true,
      centavos: 10_000_000n,
      fuente: 'BINANCE',
    });
  });

  it('no fija precio si difieren más del 1 %', () => {
    expect(elegirPrecio(10_000_000n, 10_200_000n)).toMatchObject({
      ok: false,
      motivo: 'NO_COINCIDEN',
    });
  });

  it('con un solo proveedor usa ese, y sin ninguno no hay precio', () => {
    expect(elegirPrecio(null, 9_000_000n)).toMatchObject({ ok: true, fuente: 'COINGECKO' });
    expect(elegirPrecio(null, null)).toEqual({ ok: false, motivo: 'SIN_PROVEEDORES' });
  });

  it('calcula los satoshis redondeando hacia arriba', () => {
    // USD 499 a USD 125.400 por BTC = 0,00397926 BTC (397.926,6 satoshis → 397.927).
    expect(satoshisPara(49_900, 12_540_000n)).toBe(397_927n);
    expect(satoshisPara(10_000, 10_000_000n)).toBe(100_000n);
  });

  it('guarda el precio con dos decimales', () => {
    expect(centavosATexto(6_723_412n)).toBe('67234.12');
    expect(centavosATexto(5n)).toBe('0.05');
  });
});
