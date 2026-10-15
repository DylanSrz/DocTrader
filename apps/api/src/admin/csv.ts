/**
 * Arma un CSV que Excel abre bien en español: separado por punto y coma, con BOM para los acentos y líneas CRLF.
 * Un valor que empieza por =, @, + o - se antepone con un apóstrofo para que la hoja de cálculo no lo ejecute como
 * fórmula (inyección de CSV). Se respetan los números y teléfonos (`+57 300 123 4567`, `-5`).
 */
export function aCsv(encabezados: string[], filas: string[][]): string {
  const celda = (valor: string) => {
    const formula =
      /^[=@\t\r]/.test(valor) || (/^[+-]/.test(valor) && !/^[+-][\d\s.,]+$/.test(valor));
    const seguro = formula ? `'${valor}` : valor;
    return /[";\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
  };
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(';'));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}
