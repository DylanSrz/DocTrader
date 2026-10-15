import { direccionBitcoinValida } from './bitcoin.js';
import { direccionTronValida } from './tron.js';

describe('direcciones de depósito', () => {
  it('acepta las direcciones de Bitcoin de la red principal con su checksum', () => {
    for (const d of [
      '1H8xfingRtsTvhnf4PosyhXvacXdGVWea1', // la de Binance del lanzamiento
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', // P2SH
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // segwit v0 (BIP 173)
      'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', // en mayúsculas también vale
      'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', // P2WSH
      'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', // taproot (BIP 350)
    ]) {
      expect([d, direccionBitcoinValida(d)]).toEqual([d, true]);
    }
  });

  it('rechaza las de Bitcoin con un carácter cambiado, de otra red o mal escritas', () => {
    for (const d of [
      '1H8xfingRtsTvhnf4PosyhXvacXdGVWea2',
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLz',
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
      'bc1qW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // mayúsculas y minúsculas mezcladas
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // testnet
      // Un programa v1 con checksum bech32 (no bech32m) no es válido.
      'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx',
      'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x',
      '',
    ]) {
      expect([d, direccionBitcoinValida(d)]).toEqual([d, false]);
    }
  });

  it('valida las de Tron con su checksum', () => {
    expect(direccionTronValida('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x')).toBe(true);
    expect(direccionTronValida('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4y')).toBe(false);
    expect(direccionTronValida('1H8xfingRtsTvhnf4PosyhXvacXdGVWea1')).toBe(false);
  });
});
