import { readFileSync } from 'node:fs';
import { leerEsplora } from './bitcoin.js';
import type { Lectura } from './lectura.js';
import {
  base58Codificar,
  base58Decodificar,
  CONTRATO_USDT,
  direccionTronValida,
  leerTronGrid,
  leerTronscan,
} from './tron.js';
import { ESPERA_MAXIMA_MS, evaluar, type OrdenAVerificar } from './verificacion.js';

/** Respuestas reales de los proveedores (2026-10-15), recortadas. */
const muestra = (archivo: string) =>
  JSON.parse(readFileSync(new URL(`./muestras/${archivo}`, import.meta.url), 'utf8'));

const DESTINO_TRON = 'TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x';

describe('direcciones de Tron', () => {
  it('valida el checksum y convierte entre formatos', () => {
    expect(direccionTronValida(DESTINO_TRON)).toBe(true);
    expect(direccionTronValida(CONTRATO_USDT)).toBe(true);
    expect(direccionTronValida('TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4y')).toBe(false);
    expect(direccionTronValida('1H8xfingRtsTvhnf4PosyhXvacXdGVWea1')).toBe(false);
    expect(base58Codificar(base58Decodificar(DESTINO_TRON)!)).toBe(DESTINO_TRON);
  });
});

describe('lectura de Tron', () => {
  it('TronGrid: el pago de USDT, su remitente y las confirmaciones', () => {
    const lectura = leerTronGrid(muestra('trongrid-transaccion.json'), 86_171_072);
    expect(lectura).toEqual({
      encontrada: true,
      exitosa: true,
      hora: new Date(1_789_185_213_000),
      bloque: 86_171_053,
      confirmaciones: 20,
      pagos: [{ direccion: DESTINO_TRON, unidades: 26_230_000n }],
      otraMoneda: false,
      remitentes: ['TKfz7Pu3jtxWrfHzVeozQjXsb3RfuUHGE2'],
    });
  });

  it('Tronscan da lo mismo que TronGrid', () => {
    const tronscan = leerTronscan(muestra('tronscan-transaccion.json'));
    const trongrid = leerTronGrid(muestra('trongrid-transaccion.json'), 86_171_053 + 951_060);
    expect(tronscan).toEqual(trongrid);
  });

  it('una respuesta vacía es una transacción que no existe (todavía)', () => {
    expect(leerTronGrid({}, 1)).toEqual({ encontrada: false });
    expect(leerTronscan({})).toEqual({ encontrada: false });
  });
});

describe('lectura de Bitcoin', () => {
  it('suma las salidas por dirección y cuenta las confirmaciones', () => {
    const lectura = leerEsplora(muestra('mempool-transaccion.json'), 827_398);
    expect(lectura).toMatchObject({
      encontrada: true,
      confirmaciones: 2,
      bloque: 827_397,
      hora: new Date(1_706_230_254_000),
      pagos: [{ direccion: 'bc1qgzrva028eym96uax90j28qj3aqhh3dy8gk6qvp', unidades: 13_020_741n }],
    });
    expect(lectura.encontrada && lectura.remitentes).toContain(
      '1EKMGKpPRVkehBsdVvk1UEx8pkBY43sQQK',
    );
  });

  it('sin confirmar: no tiene hora ni confirmaciones', () => {
    const tx = { ...muestra('mempool-transaccion.json'), status: { confirmed: false } };
    expect(leerEsplora(tx, 900_000)).toMatchObject({ hora: null, confirmaciones: 0, bloque: null });
  });
});

describe('los cinco chequeos', () => {
  const creada = new Date(1_789_185_000_000);
  const orden: OrdenAVerificar = {
    direccion: DESTINO_TRON,
    moneda: 'USDT',
    red: 'TRON',
    unidades: 26_230_000n,
    creadaEn: creada,
    reportadaEn: new Date(creada.getTime() + 300_000),
  };
  const lectura = (cambios: Partial<Extract<Lectura, { encontrada: true }>> = {}): Lectura => ({
    ...(leerTronGrid(muestra('trongrid-transaccion.json'), 86_171_072) as Extract<
      Lectura,
      { encontrada: true }
    >),
    ...cambios,
  });

  it('todo coincide y tiene 20 confirmaciones: verificada', () => {
    const resultado = evaluar(orden, lectura(), 20);
    expect(resultado.estado).toBe('VERIFICADA');
    expect(resultado.chequeos.map((c) => c.estado)).toEqual(['OK', 'OK', 'OK', 'OK', 'OK']);
    expect(resultado.recibido).toBe(26_230_000n);
  });

  it('faltan confirmaciones: espera', () => {
    const resultado = evaluar(orden, lectura({ confirmaciones: 5 }), 20);
    expect(resultado.estado).toBe('ESPERANDO_CONFIRMACIONES');
    expect(resultado.chequeos.at(-1)).toMatchObject({
      estado: 'ESPERA',
      texto: '5 de 20 confirmaciones',
    });
  });

  it('llegó menos: monto incompleto, con lo que llegó y lo que faltaba', () => {
    const menos = evaluar({ ...orden, unidades: 30_000_000n }, lectura(), 20);
    expect(menos.estado).toBe('MONTO_INCOMPLETO');
    expect(menos.chequeos[2]!.texto).toBe(
      'El monto es menor al de la orden (26.23 USDT de 30 USDT)',
    );
  });

  it('otra dirección, una transacción fallida o anterior a la orden: no coincide', () => {
    expect(evaluar({ ...orden, direccion: CONTRATO_USDT }, lectura(), 20).estado).toBe(
      'NO_COINCIDE',
    );
    expect(evaluar(orden, lectura({ exitosa: false }), 20).estado).toBe('NO_COINCIDE');
    const despues = { ...orden, creadaEn: new Date(creada.getTime() + 3_600_000) };
    expect(evaluar(despues, lectura(), 20)).toMatchObject({
      estado: 'NO_COINCIDE',
      chequeos: expect.arrayContaining([
        { clave: 'FECHA', estado: 'FALLA', texto: 'Se envió antes de crear la orden' },
      ]),
    });
  });

  it('otra moneda que no es USDT: no coincide', () => {
    const resultado = evaluar(orden, lectura({ pagos: [], otraMoneda: true }), 20);
    expect(resultado.estado).toBe('NO_COINCIDE');
    expect(resultado.chequeos[1]!.texto).toBe('Llegó otra moneda: la orden es en USDT');
  });

  it('no aparece: se sigue esperando, y a las 6 horas no coincide', () => {
    expect(evaluar(orden, { encontrada: false }, 20, orden.reportadaEn).estado).toBe(
      'SIN_VERIFICAR',
    );
    const tarde = new Date(orden.reportadaEn.getTime() + ESPERA_MAXIMA_MS + 1);
    expect(evaluar(orden, { encontrada: false }, 20, tarde).estado).toBe('NO_COINCIDE');
  });
});
