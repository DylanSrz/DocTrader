'use server';

import { llamarApi } from '@/lib/api';
import { guardarSesion } from '@/lib/cookies';
import { texto } from '@/lib/formulario';
import { tokenDeSesion } from '@/lib/sesion';

export interface EstadoSegundoFactor {
  paso: 'inicio' | 'escanear' | 'codigos';
  mensaje?: string;
  error?: string;
  secreto?: string;
  qr?: string;
  codigos?: string[];
  inicio?: string;
}

const SIN_SESION = 'Tu sesión terminó. Ingresa de nuevo para continuar.';

/** Paso 1: la API crea un secreto nuevo (todavía sin activar) y su código QR. */
async function empezar(): Promise<EstadoSegundoFactor> {
  const token = await tokenDeSesion();
  if (!token) return { paso: 'inicio', mensaje: SIN_SESION };
  const respuesta = await llamarApi<{ secreto: string; qr: string }>(
    '/auth/segundo-factor/configurar',
    { metodo: 'POST', token },
  );
  if (!respuesta.ok) return { paso: 'inicio', mensaje: respuesta.error.mensaje };
  return { paso: 'escanear', secreto: respuesta.datos.secreto, qr: respuesta.datos.qr };
}

/** Paso 2: el primer código de la app lo activa. La API devuelve una sesión nueva y los códigos de recuperación. */
async function activar(previo: EstadoSegundoFactor, datos: FormData): Promise<EstadoSegundoFactor> {
  const token = await tokenDeSesion();
  if (!token) return { paso: 'inicio', mensaje: SIN_SESION };
  const respuesta = await llamarApi<{
    token: string;
    expiraEn: number;
    rol: 'ADMIN' | 'CLIENT';
    codigos: string[];
  }>('/auth/segundo-factor/activar', {
    metodo: 'POST',
    cuerpo: { codigo: texto(datos, 'codigo').trim() },
    token,
  });
  if (!respuesta.ok) {
    if (respuesta.error.codigo === 'CONFIGURACION_VENCIDA') {
      return { paso: 'inicio', mensaje: respuesta.error.mensaje };
    }
    return { ...previo, error: respuesta.error.campos?.codigo ?? respuesta.error.mensaje };
  }
  await guardarSesion(respuesta.datos.token, respuesta.datos.expiraEn);
  return {
    paso: 'codigos',
    codigos: respuesta.datos.codigos,
    inicio: respuesta.datos.rol === 'ADMIN' ? '/admin' : '/panel',
  };
}

export async function segundoFactor(
  previo: EstadoSegundoFactor,
  datos: FormData,
): Promise<EstadoSegundoFactor> {
  return datos.get('paso') === 'activar' ? activar(previo, datos) : empezar();
}
