'use client';

import { requisitosContrasena } from '@doctrader/shared';
import { useState } from 'react';
import { CampoContrasena } from './campo-contrasena';
import { cx } from './cx';

function Marca({ cumple, vacio }: { cumple: boolean; vacio: boolean }) {
  if (vacio) return <span aria-hidden="true" className="size-1.5 rounded-full bg-ceniza" />;
  return cumple ? (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 text-senal">
      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 text-error">
      <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Requisito({ texto, cumple, vacio }: { texto: string; cumple: boolean; vacio: boolean }) {
  return (
    <li
      className={cx(
        'flex min-h-6 items-center gap-2.5 text-sm transition-colors duration-200',
        vacio ? 'text-ceniza' : cumple ? 'text-blanco' : 'text-niebla',
      )}
    >
      <span className="grid size-3 place-items-center">
        <Marca cumple={cumple} vacio={vacio} />
      </span>
      {texto}
      <span className="sr-only">{vacio ? '' : cumple ? ': cumple' : ': falta'}</span>
    </li>
  );
}

/**
 * Contraseña nueva con su confirmación. Debajo, los requisitos de la política (`requisitosContrasena`) y si las dos
 * coinciden, actualizados mientras se escribe. Es solo ayuda: el servidor vuelve a revisar todo al enviar.
 */
export function ContrasenaNueva({
  etiqueta = 'Contraseña',
  errores = {},
  autoFocus,
}: {
  etiqueta?: string;
  errores?: { contrasena?: string; confirmacion?: string };
  autoFocus?: boolean;
}) {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const requisitos = requisitosContrasena(contrasena);
  const coinciden = confirmacion.length > 0 && confirmacion === contrasena;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <CampoContrasena
          etiqueta={etiqueta}
          name="contrasena"
          autoComplete="new-password"
          required
          maxLength={256}
          autoFocus={autoFocus}
          value={contrasena}
          onChange={(e) => setContrasena(e.currentTarget.value)}
          error={errores.contrasena}
        />
        <ul
          id="requisitos-contrasena"
          aria-label="Requisitos de la contraseña"
          className="grid gap-1"
        >
          {requisitos.map((r) => (
            <Requisito key={r.texto} texto={r.texto} cumple={r.cumple} vacio={!contrasena} />
          ))}
          <li className="text-sm text-ceniza">
            Al enviar también revisamos que no sea una contraseña filtrada.
          </li>
        </ul>
      </div>
      <div className="grid gap-3">
        <CampoContrasena
          etiqueta="Confirma la contraseña"
          name="confirmacion"
          autoComplete="new-password"
          required
          maxLength={256}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.currentTarget.value)}
          error={errores.confirmacion}
        />
        <p aria-live="polite" className="min-h-6 text-sm">
          {confirmacion ? (
            <span className="flex items-center gap-2.5">
              <span className="grid size-3 place-items-center">
                <Marca cumple={coinciden} vacio={false} />
              </span>
              <span className={coinciden ? 'text-blanco' : 'text-niebla'}>
                {coinciden ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
              </span>
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
