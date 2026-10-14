import { cifrar, descifrar, huella, secretoAleatorio } from './cifrado.js';

const llave = Buffer.alloc(32, 7);
const llaves = new Map([[1, llave]]);

describe('cifrado por campo', () => {
  it('cifra y descifra', () => {
    const dato = cifrar(llave, 1, '1234567890', 'users.cedula');
    expect(dato[0]).toBe(1);
    expect(descifrar(llaves, dato, 'users.cedula').toString()).toBe('1234567890');
  });

  it('el mismo texto da un resultado distinto cada vez', () => {
    expect(cifrar(llave, 1, 'x', 'c').equals(cifrar(llave, 1, 'x', 'c'))).toBe(false);
  });

  it('no descifra un dato alterado', () => {
    const dato = cifrar(llave, 1, '1234567890', 'users.cedula');
    dato[dato.length - 1]! ^= 1;
    expect(() => descifrar(llaves, dato, 'users.cedula')).toThrow();
  });

  it('no descifra un dato copiado a otro campo', () => {
    const dato = cifrar(llave, 1, 'secreto', 'users.totp');
    expect(() => descifrar(llaves, dato, 'users.cedula')).toThrow();
  });

  it('no descifra con otra llave ni con una versión desconocida', () => {
    const dato = cifrar(llave, 1, 'x', 'c');
    expect(() => descifrar(new Map([[1, Buffer.alloc(32, 8)]]), dato, 'c')).toThrow();
    expect(() => descifrar(new Map([[2, llave]]), dato, 'c')).toThrow(/versión 1/);
  });
});

describe('huella', () => {
  it('es estable y depende del propósito', () => {
    expect(huella(llave, 'cedula', '123').equals(huella(llave, 'cedula', '123'))).toBe(true);
    expect(huella(llave, 'cedula', '123').equals(huella(llave, 'telefono', '123'))).toBe(false);
  });
});

describe('secretoAleatorio', () => {
  it('da 43 caracteres seguros para una URL', () => {
    expect(secretoAleatorio()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
