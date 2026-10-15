'use client';

import { useEffect, useRef } from 'react';
import type { EstadoOperacion } from '@/app/admin/acciones-operacion';
import { avisar } from '@/components/panel/aviso-breve';
import { Campo } from '@/components/ui';

/**
 * Envuelve una acción del servidor para mostrar su aviso breve apenas responde. Va en la acción y no en un efecto
 * porque, al terminar, el elemento puede salir de la lista (una cuenta ya conectada) y su efecto no correría.
 */
export function conAviso<E extends { listo?: number; aviso?: string }>(
  accion: (previo: E, datos: FormData) => Promise<E>,
) {
  return async (previo: E, datos: FormData): Promise<E> => {
    const estado = await accion(previo, datos);
    if (estado.listo && estado.listo !== previo.listo && estado.aviso) avisar(estado.aviso);
    return estado;
  };
}

/** Al terminar bien una acción, algo más que el aviso: cerrar el panel lateral, limpiar el formulario. */
export function useAlListo(estado: EstadoOperacion, alTerminar?: () => void) {
  const anterior = useRef(estado.listo);
  useEffect(() => {
    if (estado.listo && estado.listo !== anterior.current) {
      anterior.current = estado.listo;
      alTerminar?.();
    }
  }, [estado.listo, alTerminar]);
}

/**
 * El código de la app de autenticación, solo cuando la API lo pide (la confirmación vale 5 minutos). Va dentro del
 * formulario de la acción delicada: al enviarlo, se confirma y se repite la acción.
 */
export function CampoCodigo({ estado, accion }: { estado: EstadoOperacion; accion?: string }) {
  if (!estado.pideCodigo) return null;
  return (
    <Campo
      etiqueta={`Por seguridad, escribe el código de tu app${accion ? ` para ${accion}` : ''}`}
      name="codigo"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      autoFocus
      required
      className="max-w-[22rem]"
    />
  );
}

export function ErrorOperacion({ estado }: { estado: EstadoOperacion }) {
  const error = estado.error ?? (estado.campos ? Object.values(estado.campos)[0] : undefined);
  return error ? (
    <p role="alert" className="basis-full text-sm text-error">
      {error}
    </p>
  ) : null;
}
