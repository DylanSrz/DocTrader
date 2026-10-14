import { validarEntorno } from './entorno.js';

const valido = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  AUDIT_HMAC_KEY: Buffer.alloc(32, 1).toString('base64'),
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

  it('rechaza una base de datos que no es Postgres', () => {
    expect(() => validarEntorno({ ...valido, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
