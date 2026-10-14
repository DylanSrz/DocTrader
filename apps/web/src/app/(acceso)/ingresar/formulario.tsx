'use client';

import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { Aviso, BotonEnviar, Campo, CampoContrasena, Enlace } from '@/components/ui';
import { type EstadoIngreso, ingreso } from '../acciones';
import { ReenviarVerificacion } from '../reenviar-verificacion';

export function FormularioIngreso() {
  const [estado, accion] = useActionState(ingreso, {} as EstadoIngreso);

  // Paso 2: el código del segundo factor.
  if (estado.paso === 'codigo') {
    return (
      <form action={accion} className="grid gap-6" noValidate>
        <input type="hidden" name="paso" value="codigo" />
        <h2 className="text-medio">Escribe el código de tu app de autenticación.</h2>
        {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
        <Campo
          etiqueta="Código de 6 dígitos"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={20}
          ayuda="¿No tienes el celular a mano? Escribe uno de tus códigos de recuperación."
          error={estado.campos?.codigo}
        />
        <BotonEnviar enviando="Revisando…" className="justify-self-start">
          Ingresar
        </BotonEnviar>
      </form>
    );
  }

  return (
    <div className="grid gap-8">
      <form action={accion} className="grid gap-6" noValidate>
        {estado.mensaje ? (
          <Aviso tono={estado.sinVerificar ? 'neutro' : 'error'}>{estado.mensaje}</Aviso>
        ) : null}
        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={estado.valores?.correo}
          error={estado.campos?.correo}
        />
        <CampoContrasena
          etiqueta="Contraseña"
          name="contrasena"
          autoComplete="current-password"
          required
          error={estado.campos?.contrasena}
        />
        {estado.desafio ? <Turnstile key={estado.envio} /> : null}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <BotonEnviar enviando="Ingresando…">Ingresar</BotonEnviar>
          <Enlace href="/recuperar" gris>
            Olvidé mi contraseña
          </Enlace>
        </div>
      </form>

      {estado.sinVerificar ? <ReenviarVerificacion correo={estado.valores?.correo ?? ''} /> : null}

      <p className="text-[15px] text-niebla">
        ¿Todavía no tienes cuenta?{' '}
        <Enlace href="/registro" className="text-[15px]">
          Regístrate
        </Enlace>
      </p>
    </div>
  );
}
