'use client';

import { useEffect, useState } from 'react';

/**
 * El secreto de los enlaces de los correos va después de `#` (`/restablecer#token=…`): el navegador nunca lo
 * envía a ningún servidor, así que no queda en registros ni en el encabezado Referer. Se lee aquí y se quita de
 * la barra de direcciones. `undefined` mientras se lee; `null` si el enlace no trae token.
 */
export function useTokenDelEnlace(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const valor = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (valor) window.history.replaceState(null, '', window.location.pathname);
    // Leer el hash solo es posible en el navegador, después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(valor && /^[A-Za-z0-9_-]{43}$/.test(valor) ? valor : null);
  }, []);
  return token;
}
