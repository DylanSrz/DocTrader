import 'server-only';
import { Marked } from 'marked';

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Markdown a HTML para los textos que se editan desde el panel (textos legales y preguntas frecuentes). El HTML
 * escrito a mano se muestra como texto, nunca se interpreta, y solo se permiten enlaces http(s) y mailto, que
 * abren en otra pestaña.
 */
const convertidor = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escapar(text);
    },
    link({ href, text }) {
      if (!/^(https?:|mailto:)/i.test(href)) return escapar(text);
      return `<a href="${escapar(href)}" target="_blank" rel="noopener">${escapar(text)}</a>`;
    },
    image({ text }) {
      return escapar(text);
    },
  },
});

export function markdownAHtml(texto: string): string {
  return convertidor.parse(texto, { async: false });
}
