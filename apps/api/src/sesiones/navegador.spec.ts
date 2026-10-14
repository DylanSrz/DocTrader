import { describirNavegador } from './navegador.js';

describe('describirNavegador', () => {
  it('reconoce los navegadores más comunes', () => {
    expect(
      describirNavegador(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      ),
    ).toBe('Chrome en Windows');
    expect(
      describirNavegador(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari en iPhone o iPad');
    expect(
      describirNavegador(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      ),
    ).toBe('Edge en Mac');
  });

  it('sin user agent dice que no lo conoce', () => {
    expect(describirNavegador(undefined)).toBe('Navegador desconocido');
  });
});
