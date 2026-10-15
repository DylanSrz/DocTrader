'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * El secreto de los enlaces de los correos va después de `#` (`/restablecer#token=…`): el navegador nunca lo
 * envía a ningún servidor, así que no queda en registros ni en el encabezado Referer. Se lee aquí y se quita de
 * la barra de direcciones. `undefined` mientras se lee; `null` si el enlace no trae token.
 *
 * Lo leído se guarda en una ref: si React vuelve a montar el componente (en desarrollo monta dos veces), el
 * hash ya no está en la barra y sin la ref se perdería el token.
 */
export function useTokenDelEnlace(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const leido = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (leido.current === undefined) {
      const valor = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (valor) window.history.replaceState(null, '', window.location.pathname);
      leido.current = valor && /^[A-Za-z0-9_-]{43}$/.test(valor) ? valor : null;
    }
    // Leer el hash solo es posible en el navegador, después de montar.
    setToken(leido.current);
  }, []);
  return token;
}
