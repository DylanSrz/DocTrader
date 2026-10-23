import { validarEntorno } from './entorno.js';

const valido = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  AUDIT_HMAC_KEY: Buffer.alloc(32, 1).toString('base64'),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  LOOKUP_HMAC_KEY: Buffer.alloc(32, 3).toString('base64'),
};

describe('validarEntorno', () => {
  it('acepta un entorno completo y pone los valores por defecto', () => {
    const entorno = validarEntorno(valido);
    expect(entorno.PORT).toBe(4000);
    expect(entorno.DATABASE_SSL).toBe(false);
    expect(entorno.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('dice qué variable falta', () => {
    expect(() => validarEntorno({ ...valido, REDIS_URL: undefined })).toThrow(/REDIS_URL/);
  });

  it('rechaza una llave de auditoría que no tiene 32 bytes', () => {
    expect(() => validarEntorno({ ...valido, AUDIT_HMAC_KEY: 'corta' })).toThrow(/AUDIT_HMAC_KEY/);
  });

  it('pide las llaves de cifrado y de búsqueda', () => {
    expect(() => validarEntorno({ ...valido, DATA_ENCRYPTION_KEY: undefined })).toThrow(
      /DATA_ENCRYPTION_KEY/,
    );
    expect(() => validarEntorno({ ...valido, LOOKUP_HMAC_KEY: 'corta' })).toThrow(
      /LOOKUP_HMAC_KEY/,
    );
  });

  it('rechaza un secreto de la web demasiado corto', () => {
    expect(() => validarEntorno({ ...valido, PROXY_SECRET: 'corto' })).toThrow(/PROXY_SECRET/);
  });

  it('rechaza una base de datos que no es Postgres', () => {
    expect(() => validarEntorno({ ...valido, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('acepta una rotación de la llave de cifrado solo con la versión siguiente y una llave distinta', () => {
    const anterior = Buffer.alloc(32, 9).toString('base64');
    expect(() => validarEntorno({ ...valido, DATA_ENCRYPTION_KEY_ANTERIOR: anterior })).toThrow(
      /DATA_ENCRYPTION_KEY_VERSION/,
    );
    expect(
      validarEntorno({
        ...valido,
        DATA_ENCRYPTION_KEY_ANTERIOR: anterior,
        DATA_ENCRYPTION_KEY_VERSION: '2',
      }).DATA_ENCRYPTION_KEY_VERSION,
    ).toBe(2);
    expect(() =>
      validarEntorno({
        ...valido,
        DATA_ENCRYPTION_KEY_ANTERIOR: valido.DATA_ENCRYPTION_KEY,
        DATA_ENCRYPTION_KEY_VERSION: '2',
      }),
    ).toThrow(/DATA_ENCRYPTION_KEY_ANTERIOR/);
    expect(() =>
      validarEntorno({ ...valido, AUDIT_HMAC_KEY_ANTERIOR: valido.AUDIT_HMAC_KEY }),
    ).toThrow(/AUDIT_HMAC_KEY_ANTERIOR/);
  });
});
