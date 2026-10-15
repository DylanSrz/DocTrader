'use client';

import { type ComponentProps, useState } from 'react';
import { Campo } from './campo';

/** Campo de contraseña con "Mostrar": escribir largo sin ver es la causa de muchos errores al registrarse. */
export function CampoContrasena(props: Omit<ComponentProps<typeof Campo>, 'type' | 'final'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      final={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="min-h-11 rounded-pildora px-3 text-sm font-normal text-ceniza transition-colors duration-200 hover:text-blanco"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      }
    />
  );
}
