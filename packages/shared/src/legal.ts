/**
 * El texto público de un borrador de `docs/legal/`: sin el título (la página lo pone aparte), sin la nota interna
 * del principio ("Borrador del…, conviene que lo revise un abogado") y sin lo que va después de la línea `---`
 * final (anexos internos, como el texto de la casilla del registro o la versión corta del aviso de riesgo).
 */
export function textoPublicoDeBorrador(markdown: string): string {
  const sinEncabezado = markdown
    .replace(/\r\n/g, '\n')
    .replace(/^# [^\n]*\n+/, '')
    .replace(/^(>[^\n]*\n)+\n*/, '');
  const corte = sinEncabezado.search(/\n---\n/);
  return (corte === -1 ? sinEncabezado : sinEncabezado.slice(0, corte)).trim();
}
