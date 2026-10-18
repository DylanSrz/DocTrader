import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnstileService } from './turnstile.service.js';

function servicio(secreto: string | undefined) {
  const valores: Record<string, string | undefined> = {
    TURNSTILE_SECRET: secreto,
    WEB_ORIGIN: 'https://www.doctraderpro.com',
  };
  return new TurnstileService({ get: (clave: string) => valores[clave] } as never);
}

function cloudflareResponde(cuerpo: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: 200 })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('TurnstileService', () => {
  const secreto = '0x4AAAAAAAsecretoReal';

  it('acepta un token válido resuelto en la web de la plataforma', async () => {
    cloudflareResponde({ success: true, hostname: 'www.doctraderpro.com' });
    expect(await servicio(secreto).valido('token', '1.2.3.4')).toBe(true);
    cloudflareResponde({ success: true, hostname: 'doctraderpro.com' });
    expect(await servicio(secreto).valido('token', '1.2.3.4')).toBe(true);
  });

  it('rechaza un token resuelto en otro dominio', async () => {
    cloudflareResponde({ success: true, hostname: 'sitio-ajeno.com' });
    expect(await servicio(secreto).valido('token', '1.2.3.4')).toBe(false);
  });

  it('rechaza un token que Cloudflare no da por bueno, uno vacío o sin respuesta', async () => {
    cloudflareResponde({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    expect(await servicio(secreto).valido('token', '1.2.3.4')).toBe(false);
    expect(await servicio(secreto).valido(undefined, '1.2.3.4')).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('sin red'))),
    );
    expect(await servicio(secreto).valido('token', '1.2.3.4')).toBe(false);
  });

  it('con las llaves de prueba de Cloudflare no revisa el dominio', async () => {
    cloudflareResponde({ success: true, hostname: 'example.com' });
    expect(await servicio('1x0000000000000000000000000000000AA').valido('t', '1.2.3.4')).toBe(true);
  });

  it('sin secreto configurado no exige el desafío', async () => {
    expect(await servicio(undefined).valido(undefined, '1.2.3.4')).toBe(true);
  });
});
