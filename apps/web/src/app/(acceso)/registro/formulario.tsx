'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CorreoSoporte } from '@/components/correo-soporte';
import { Turnstile } from '@/components/turnstile';
import {
  Aviso,
  BotonEnviar,
  Campo,
  CampoDocumento,
  Casilla,
  ContrasenaNueva,
  Enlace,
} from '@/components/ui';
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
      {/*
        React reinicia el formulario después de cada envío: con la `key` estos campos (que llevan su estado) se vuelven
        a armar con lo que devolvió el servidor, y la lista de tipos nunca queda de otro país.
      */}
      <CampoDocumento
        key={`documento-${estado.envio ?? 0}`}
        valores={v}
        errores={e}
        ayuda={
          <>
            ¿No encuentras tu país o tu documento? Escríbenos a <CorreoSoporte /> y lo revisamos.
          </>
        }
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
      <ContrasenaNueva key={`contrasena-${estado.envio ?? 0}`} errores={e} />

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

      <details className="group" open={Boolean(v.codigoReferido || e.codigoReferido) || undefined}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] text-niebla underline decoration-white/35 underline-offset-[6px] hover:text-blanco [&::-webkit-details-marker]:hidden">
          ¿Tienes un código de invitación?
        </summary>
        <Campo
          etiqueta="Código de invitación (opcional)"
          name="codigoReferido"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          ayuda="Son 8 letras y números. Si llegaste por el enlace de quien te invitó, no hace falta."
          defaultValue={v.codigoReferido}
          error={e.codigoReferido}
          className="mt-3"
        />
      </details>

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
