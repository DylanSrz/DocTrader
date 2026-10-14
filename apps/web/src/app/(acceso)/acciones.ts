'use server';

import { CONTRASENA_MAXIMO, CONTRASENA_MINIMO } from '@doctrader/shared';
import { redirect } from 'next/navigation';
import { type ErrorApi, llamarApi } from '@/lib/api';
import { borrarSesion, guardarSesion, identificadorDelNavegador } from '@/lib/cookies';
import { type EstadoFormulario, texto } from '@/lib/formulario';
import { inicioDe, tokenDeSesion } from '@/lib/sesion';

interface Ingreso {
  token: string;
  estado: 'COMPLETA' | 'SEGUNDO_FACTOR_PENDIENTE' | 'SEGUNDO_FACTOR_POR_CONFIGURAR';
  rol: 'ADMIN' | 'CLIENT';
  expiraEn: number;
}

export interface EstadoIngreso extends EstadoFormulario {
  /** Falta el código del segundo factor. */
  paso?: 'codigo';
  /** La contraseña era correcta pero falta confirmar el correo. */
  sinVerificar?: boolean;
}

export interface EstadoRegistro extends EstadoFormulario {
  /** La cuenta quedó creada: se muestra "revisa tu correo". */
  correoEnviadoA?: string;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function desdeError(error: ErrorApi, previo: EstadoFormulario, valores?: Record<string, string>) {
  return {
    envio: (previo.envio ?? 0) + 1,
    mensaje: error.campos ? undefined : error.mensaje,
    campos: error.campos,
    desafio: error.desafio ?? previo.desafio,
    valores,
  } satisfies EstadoFormulario;
}

function revisarContrasena(contrasena: string): string | undefined {
  if (contrasena.length < CONTRASENA_MINIMO) {
    return `Usa al menos ${CONTRASENA_MINIMO} caracteres. Una frase corta es fácil de recordar y difícil de adivinar.`;
  }
  if (contrasena.length > CONTRASENA_MAXIMO)
    return `Usa como máximo ${CONTRASENA_MAXIMO} caracteres.`;
  return undefined;
}

// ── Registro ─────────────────────────────────────────────────────────────────────────────────────────────

export async function registrar(previo: EstadoRegistro, datos: FormData): Promise<EstadoRegistro> {
  const valores = {
    nombre: texto(datos, 'nombre').trim(),
    cedula: texto(datos, 'cedula').trim(),
    correo: texto(datos, 'correo').trim(),
    telefono: texto(datos, 'telefono').trim(),
    aceptaTerminos: datos.get('aceptaTerminos') === 'on' ? 'on' : '',
    aceptaDatos: datos.get('aceptaDatos') === 'on' ? 'on' : '',
    aceptaRiesgo: datos.get('aceptaRiesgo') === 'on' ? 'on' : '',
    aceptaMercadeo: datos.get('aceptaMercadeo') === 'on' ? 'on' : '',
  };
  const contrasena = texto(datos, 'contrasena');

  const campos: Record<string, string> = {};
  if (valores.nombre.length < 3) campos.nombre = 'Escribe tu nombre completo.';
  if (valores.cedula.length < 5) campos.cedula = 'Escribe tu número de cédula.';
  if (!CORREO.test(valores.correo))
    campos.correo = 'Escribe un correo válido, como nombre@gmail.com.';
  if (valores.telefono.replace(/\D/g, '').length < 7)
    campos.telefono = 'Escribe tu número de celular.';
  const problema = revisarContrasena(contrasena);
  if (problema) campos.contrasena = problema;
  if (!valores.aceptaTerminos) campos.aceptaTerminos = 'Debes aceptar los términos de la licencia.';
  if (!valores.aceptaDatos) campos.aceptaDatos = 'Debes autorizar el tratamiento de tus datos.';
  if (!valores.aceptaRiesgo) campos.aceptaRiesgo = 'Debes leer y aceptar el aviso de riesgo.';
  if (Object.keys(campos).length > 0) {
    return { envio: (previo.envio ?? 0) + 1, campos, valores, desafio: previo.desafio };
  }

  const respuesta = await llamarApi('/auth/registro', {
    metodo: 'POST',
    cuerpo: {
      nombre: valores.nombre,
      cedula: valores.cedula,
      correo: valores.correo,
      telefono: valores.telefono,
      contrasena,
      aceptaTerminos: true,
      aceptaDatos: true,
      aceptaRiesgo: true,
      aceptaMercadeo: valores.aceptaMercadeo === 'on',
      turnstile: texto(datos, 'turnstile') || undefined,
    },
  });
  if (!respuesta.ok) return desdeError(respuesta.error, previo, valores);
  return { correoEnviadoA: valores.correo };
}

export async function verificarCorreo(
  previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const respuesta = await llamarApi('/auth/verificar-correo', {
    metodo: 'POST',
    cuerpo: { token: texto(datos, 'token') },
  });
  if (!respuesta.ok) return desdeError(respuesta.error, previo);
  return { exito: true, mensaje: 'Listo: tu correo quedó confirmado. Ya puedes ingresar.' };
}

export async function reenviarVerificacion(
  previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, 'correo').trim();
  const respuesta = await llamarApi('/auth/reenviar-verificacion', {
    metodo: 'POST',
    cuerpo: { correo, turnstile: texto(datos, 'turnstile') || undefined },
  });
  if (!respuesta.ok) return desdeError(respuesta.error, previo, { correo });
  return {
    envio: (previo.envio ?? 0) + 1,
    exito: true,
    mensaje: `Si ${correo} tiene una cuenta sin confirmar, te llegará un enlace nuevo en unos segundos. Revisa también la carpeta de spam.`,
  };
}

// ── Ingreso ──────────────────────────────────────────────────────────────────────────────────────────────

async function continuarIngreso(ingreso: Ingreso): Promise<EstadoIngreso> {
  await guardarSesion(ingreso.token, ingreso.expiraEn);
  if (ingreso.estado === 'SEGUNDO_FACTOR_PENDIENTE') return { paso: 'codigo' };
  if (ingreso.estado === 'SEGUNDO_FACTOR_POR_CONFIGURAR') redirect('/segundo-factor');
  redirect(inicioDe(ingreso.rol));
}

/** Los dos pasos del ingreso en una sola acción: correo y contraseña, y luego (si aplica) el código. */
export async function ingreso(previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  return datos.get('paso') === 'codigo' ? enviarCodigo(previo, datos) : ingresar(previo, datos);
}

async function ingresar(previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const correo = texto(datos, 'correo').trim();
  const contrasena = texto(datos, 'contrasena');
  if (!correo || !contrasena) {
    return {
      envio: (previo.envio ?? 0) + 1,
      valores: { correo },
      desafio: previo.desafio,
      campos: {
        ...(correo ? {} : { correo: 'Escribe tu correo.' }),
        ...(contrasena ? {} : { contrasena: 'Escribe tu contraseña.' }),
      },
    };
  }
  const respuesta = await llamarApi<Ingreso>('/auth/ingresar', {
    metodo: 'POST',
    cuerpo: {
      correo,
      contrasena,
      dispositivo: await identificadorDelNavegador(),
      turnstile: texto(datos, 'turnstile') || undefined,
    },
  });
  if (!respuesta.ok) {
    return {
      ...desdeError(respuesta.error, previo, { correo }),
      sinVerificar: respuesta.error.codigo === 'CORREO_SIN_VERIFICAR',
    };
  }
  return continuarIngreso(respuesta.datos);
}

async function enviarCodigo(previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const token = await tokenDeSesion();
  if (!token) return { mensaje: 'Tu sesión terminó. Ingresa de nuevo.' };
  const respuesta = await llamarApi<Ingreso>('/auth/segundo-factor', {
    metodo: 'POST',
    cuerpo: { codigo: texto(datos, 'codigo').trim() },
    token,
  });
  if (!respuesta.ok) {
    // Después de 5 códigos equivocados la API cierra la sesión: se vuelve al primer paso.
    if (respuesta.error.codigo === 'SIN_SESION') {
      await borrarSesion();
      return { mensaje: respuesta.error.mensaje };
    }
    return { ...desdeError(respuesta.error, previo), paso: 'codigo' };
  }
  return continuarIngreso(respuesta.datos);
}

// ── Recuperar la contraseña ──────────────────────────────────────────────────────────────────────────────

export async function recuperar(
  previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, 'correo').trim();
  if (!CORREO.test(correo)) {
    return {
      envio: (previo.envio ?? 0) + 1,
      campos: { correo: 'Escribe un correo válido.' },
      valores: { correo },
    };
  }
  const respuesta = await llamarApi('/auth/recuperar', {
    metodo: 'POST',
    cuerpo: { correo, turnstile: texto(datos, 'turnstile') || undefined },
  });
  if (!respuesta.ok) return desdeError(respuesta.error, previo, { correo });
  return {
    exito: true,
    mensaje: `Si ${correo} tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Vale 30 minutos. Revisa también la carpeta de spam.`,
  };
}

export async function restablecer(
  previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const contrasena = texto(datos, 'contrasena');
  const problema = revisarContrasena(contrasena);
  if (problema) return { envio: (previo.envio ?? 0) + 1, campos: { contrasena: problema } };
  const respuesta = await llamarApi('/auth/restablecer', {
    metodo: 'POST',
    cuerpo: { token: texto(datos, 'token'), contrasena },
  });
  if (!respuesta.ok) return desdeError(respuesta.error, previo);
  return {
    exito: true,
    mensaje: 'Tu contraseña quedó cambiada y cerramos todas tus sesiones. Ya puedes ingresar.',
  };
}
