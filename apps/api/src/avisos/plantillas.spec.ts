import { PLANTILLA, renderizar } from './plantillas.js';

const web = 'https://doctraderpro.com';

describe('plantillas de correo', () => {
  it('cada plantilla se arma con asunto, texto y HTML', () => {
    for (const plantilla of Object.values(PLANTILLA)) {
      const correo = renderizar(
        plantilla,
        { nombre: 'Ana', fecha: 'hoy', restantes: '9' },
        's',
        web,
      );
      expect(correo.asunto.length).toBeGreaterThan(5);
      expect(correo.texto).toContain('nunca te pedirá tu contraseña');
      expect(correo.html).toContain('<!doctype html>');
    }
  });

  it('el enlace va después de # para que no quede en los registros de ningún servidor', () => {
    const correo = renderizar(PLANTILLA.VERIFICAR_CORREO, { nombre: 'Ana' }, 'abc', web);
    expect(correo.texto).toContain('https://doctraderpro.com/verificar-correo#token=abc');
  });

  it('escapa el HTML de los datos del cliente', () => {
    const correo = renderizar(
      PLANTILLA.VERIFICAR_CORREO,
      { nombre: '<script>x</script>' },
      'a',
      web,
    );
    expect(correo.html).not.toContain('<script>');
    expect(correo.html).toContain('&lt;script&gt;');
  });

  it('el encabezado lleva el logo de la marca, con dirección absoluta', () => {
    const correo = renderizar(PLANTILLA.BIENVENIDA, { nombre: 'Ana' }, null, web);
    expect(correo.html).toContain('src="https://www.doctraderpro.com/marca/icono-192.png"');
  });

  it('una plantilla desconocida es un error', () => {
    expect(() => renderizar('no-existe', {}, null, web)).toThrow(/desconocida/);
  });
});
