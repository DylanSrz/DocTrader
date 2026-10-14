/** Nombre corto del navegador y el sistema ("Chrome en Windows"), para la lista de sesiones y los avisos. */
export function describirNavegador(userAgent: string | undefined): string {
  if (!userAgent) return 'Navegador desconocido';
  const navegador = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /SamsungBrowser/.test(userAgent)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(userAgent)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(userAgent)
            ? 'Chrome'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : 'Navegador';
  const sistema = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iPhone o iPad'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'Mac'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return sistema ? `${navegador} en ${sistema}` : navegador;
}
