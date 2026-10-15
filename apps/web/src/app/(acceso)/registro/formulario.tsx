'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { Aviso, BotonEnviar, Campo, CampoContrasena, Casilla, Enlace } from '@/components/ui';
import { type EstadoRegistro, registrar } from '../acciones';

function EnlaceLegal({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      className="text-blanco underline decoration-white/35 underline-offset-4 hover:decoration-current"
    >
      {children}
    </Link>
  );
}

export function FormularioRegistro() {
  const [estado, accion] = useActionState(registrar, {} as EstadoRegistro);

  if (estado.correoEnviadoA) {
    return (
      <div className="grid gap-6" role="status">
        <h2 className="text-medio">Revisa tu correo.</h2>
        <p className="text-niebla">
          Te enviamos un enlace a <span className="text-blanco">{estado.correoEnviadoA}</span> para
          confirmar tu cuenta. Vale 24 horas. Si no lo ves en unos minutos, revisa la carpeta de
          spam.
        </p>
        <Enlace href="/ingresar">Ir a ingresar</Enlace>
      </div>
    );
  }

  const v = estado.valores ?? {};
  const e = estado.campos ?? {};
  return (
    <form action={accion} className="grid gap-6" noValidate>
      {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
      <Campo
        etiqueta="Nombre completo"
        name="nombre"
        autoComplete="name"
        required
        maxLength={120}
        defaultValue={v.nombre}
        error={e.nombre}
      />
      <Campo
        etiqueta="Cédula"
        name="cedula"
        inputMode="text"
        autoComplete="off"
        required
        maxLength={20}
        ayuda="Solo una cuenta por persona. Si eres extranjero, escribe tu cédula de extranjería o pasaporte."
        defaultValue={v.cedula}
        error={e.cedula}
      />
      <Campo
        etiqueta="Correo"
        name="correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        defaultValue={v.correo}
        error={e.correo}
      />
      <Campo
        etiqueta="Celular"
        name="telefono"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        maxLength={25}
        ayuda="Si no es de Colombia, empieza con + y el indicativo del país."
        defaultValue={v.telefono}
        error={e.telefono}
      />
      <CampoContrasena
        etiqueta="Contraseña"
        name="contrasena"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        ayuda="Al menos 10 caracteres. Una frase corta funciona bien."
        error={e.contrasena}
      />

      <fieldset className="grid gap-1">
        <legend className="sr-only">Autorizaciones</legend>
        <Casilla
          name="aceptaTerminos"
          required
          defaultChecked={v.aceptaTerminos === 'on'}
          error={e.aceptaTerminos}
        >
          Acepto los <EnlaceLegal href="/legal/terminos">términos de la licencia</EnlaceLegal>.
        </Casilla>
        <Casilla
          name="aceptaDatos"
          required
          defaultChecked={v.aceptaDatos === 'on'}
          error={e.aceptaDatos}
        >
          Autorizo el{' '}
          <EnlaceLegal href="/legal/datos">tratamiento de mis datos personales</EnlaceLegal>.
        </Casilla>
        <Casilla
          name="aceptaRiesgo"
          required
          defaultChecked={v.aceptaRiesgo === 'on'}
          error={e.aceptaRiesgo}
        >
          Leí el <EnlaceLegal href="/legal/riesgo">aviso de riesgo</EnlaceLegal>: operar puede
          hacerme perder dinero y los resultados pasados no garantizan los futuros.
        </Casilla>
        <Casilla name="aceptaMercadeo" defaultChecked={v.aceptaMercadeo === 'on'}>
          Quiero recibir novedades y promociones por correo (opcional).
        </Casilla>
      </fieldset>

      <Turnstile key={estado.envio} />
      <BotonEnviar enviando="Creando tu cuenta…" className="justify-self-start">
        Crear cuenta
      </BotonEnviar>
      <p className="text-[15px] text-niebla">
        ¿Ya tienes cuenta?{' '}
        <Enlace href="/ingresar" className="text-[15px]">
          Ingresa
        </Enlace>
      </p>
    </form>
  );
}
