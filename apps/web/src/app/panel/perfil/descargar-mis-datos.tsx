'use client';

import { BotonAccion, useEstadoAccion } from '@/components/ui';

const RUTA = '/panel/perfil/mis-datos';

/**
 * "Descargar mis datos": pide el archivo, y solo cuando llegó completo lo entrega al navegador. Así el botón muestra
 * "Preparando…" mientras se arma y dice si falló (límite de descargas, sesión vencida, sin conexión).
 */
export function DescargarMisDatos() {
  const [estado, setEstado] = useEstadoAccion();
  return (
    <BotonAccion
      variante="enlace"
      estado={estado}
      textos={{
        normal: 'Descargar mis datos',
        procesando: 'Preparando tus datos…',
        exito: 'Listo: el archivo se descargó',
        error: 'No se pudo descargar. Toca para intentar de nuevo',
      }}
      onClick={async () => {
        setEstado('procesando');
        try {
          const respuesta = await fetch(RUTA, { cache: 'no-store' });
          const tipo = respuesta.headers.get('content-type') ?? '';
          if (!respuesta.ok || !tipo.includes('application/json')) {
            throw new Error(String(respuesta.status));
          }
          const archivo = await respuesta.blob();
          const nombre =
            /filename="([^"]+)"/.exec(respuesta.headers.get('content-disposition') ?? '')?.[1] ??
            'doctraderpro-mis-datos.json';
          const url = URL.createObjectURL(archivo);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = nombre;
          document.body.append(enlace);
          enlace.click();
          enlace.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setEstado('exito');
        } catch {
          setEstado('error');
        }
      }}
    />
  );
}
