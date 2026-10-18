'use client';

import { BotonAccion, copiarTexto, useEstadoAccion } from '@/components/ui';

/**
 * El correo oficial como enlace `mailto:` (abre la app de correo) y, al lado, "Copiar correo" para quien no tiene una
 * configurada.
 */
export function CopiarCorreo({ correo }: { correo: string }) {
  const [estado, setEstado] = useEstadoAccion();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      <a
        href={`mailto:${correo}`}
        translate="no"
        className="inline-flex min-h-11 items-center text-blanco underline decoration-white/35 underline-offset-[6px] transition-colors hover:decoration-current"
      >
        {correo}
      </a>
      <BotonAccion
        variante="enlace"
        className="text-ceniza hover:text-blanco"
        estado={estado}
        textos={{
          normal: 'Copiar correo',
          procesando: 'Copiando…',
          exito: '¡Copiado!',
          error: 'No se copió: selecciónalo y cópialo',
        }}
        onClick={async () => {
          setEstado('procesando');
          setEstado((await copiarTexto(correo)) ? 'exito' : 'error');
        }}
      />
    </span>
  );
}
