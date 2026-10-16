import { describe, expect, it } from 'vitest';
import { type DepositoBinance, leerDepositoBinance } from './binance.js';
import { evaluar } from './verificacion.js';

/** Como responde Binance en `GET /sapi/v1/capital/deposit/hisrec` a una transferencia entre cuentas. */
const interna = (cambios: Partial<DepositoBinance> = {}): DepositoBinance => ({
  amount: '119.37000000',
  coin: 'USDT',
  network: 'TRX',
  status: 1,
  address: 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x',
  txId: 'Off-chain transfer 421231346716',
  insertTime: Date.UTC(2026, 9, 15, 18, 58),
  transferType: 1,
  ...cambios,
});

const orden = {
  direccion: 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x',
  moneda: 'USDT' as const,
  red: 'TRON' as const,
  unidades: 119_370_000n,
  creadaEn: new Date(Date.UTC(2026, 9, 15, 18, 50)),
  reportadaEn: new Date(Date.UTC(2026, 9, 15, 19, 0)),
  interna: true,
};

describe('transferencias internas de Binance', () => {
  it('encuentra la transferencia por su número y la verifica como un pago en la blockchain', () => {
    const lectura = leerDepositoBinance(
      [interna({ txId: 'Off-chain transfer 999', amount: '5' }), interna()],
      '421231346716',
      'USDT',
    );
    expect(lectura).toMatchObject({
      encontrada: true,
      exitosa: true,
      pagos: [{ direccion: orden.direccion, unidades: 119_370_000n }],
      otraMoneda: false,
      interna: true,
    });
    expect(evaluar(orden, lectura, 20).estado).toBe('VERIFICADA');
  });

  it('sin la transferencia en el historial, espera', () => {
    const lectura = leerDepositoBinance([interna()], '111111111', 'USDT');
    const resultado = evaluar(orden, lectura, 20, new Date(Date.UTC(2026, 9, 15, 19, 5)));
    expect(resultado.estado).toBe('SIN_VERIFICAR');
    expect(resultado.nota).toContain('historial de Binance');
  });

  it('otra moneda, otro monto o en proceso no se aprueban solos', () => {
    expect(
      evaluar(orden, leerDepositoBinance([interna({ coin: 'USDC' })], '421231346716', 'USDT'), 20)
        .estado,
    ).toBe('NO_COINCIDE');
    expect(
      evaluar(orden, leerDepositoBinance([interna({ amount: '120' })], '421231346716', 'USDT'), 20)
        .estado,
    ).toBe('NO_COINCIDE');
    expect(
      evaluar(orden, leerDepositoBinance([interna({ status: 0 })], '421231346716', 'USDT'), 20)
        .estado,
    ).toBe('ESPERANDO_CONFIRMACIONES');
    expect(
      evaluar(
        orden,
        leerDepositoBinance(
          [interna({ insertTime: Date.UTC(2026, 9, 15, 18, 0) })],
          '421231346716',
          'USDT',
        ),
        20,
      ).estado,
    ).toBe('NO_COINCIDE');
  });
});
