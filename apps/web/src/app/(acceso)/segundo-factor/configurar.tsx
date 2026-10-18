'use client';

import { useActionState, useState } from 'react';
import {
  Aviso,
  BotonAccion,
  BotonEnviar,
  Campo,
  Casilla,
  copiarTexto,
  descargarContenido,
  Enlace,
  Pildora,
  useEstadoAccion,
} from '@/components/ui';
import { type EstadoSegundoFactor, segundoFactor } from './acciones';

/** Configurar la app de autenticación en tres pasos: empezar, escanear el QR y guardar los códigos. */
export function ConfigurarSegundoFactor({
  obligatorio,
  yaActivo,
  inicio,
}: {
  obligatorio: boolean;
  yaActivo: boolean;
  inicio: string;
}) {
  const [estado, accion] = useActionState(segundoFactor, { paso: 'inicio' } as EstadoSegundoFactor);

  if (estado.paso === 'codigos') {
    return (
      <CodigosDeRecuperacion codigos={estado.codigos ?? []} inicio={estado.inicio ?? inicio} />
    );
  }

  if (estado.paso === 'escanear') {
    return (
      <form action={accion} className="grid gap-6" noValidate>
        <input type="hidden" name="paso" value="activar" />
        <h2 className="text-medio">1. Escanea este código con la app.</h2>
        {/* El QR es una imagen PNG que genera la API; no necesita optimización. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={estado.qr}
          alt="Código QR para la app de autenticación"
          width={240}
          height={240}
          className="rounded-[16px] bg-blanco p-2"
        />
        <details className="text-[15px] text-niebla">
          <summary className="min-h-11 cursor-pointer content-center text-blanco">
            ¿No puedes escanearlo? Escribe la clave a mano
          </summary>
          <p className="mt-2 cifra break-all text-blanco select-all" translate="no">
            {estado.secreto?.match(/.{1,4}/g)?.join(' ')}
          </p>
        </details>
        <h2 className="text-medio">2. Escribe el código que muestra.</h2>
        <Campo
          etiqueta="Código de 6 dígitos"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          error={estado.error}
        />
        <BotonEnviar enviando="Activando…" className="justify-self-start">
          Activar
        </BotonEnviar>
      </form>
    );
  }

  if (yaActivo) {
    return (
      <div className="grid gap-6">
        <Aviso tono="exito">Tu cuenta ya tiene el segundo factor activo.</Aviso>
        <Enlace href={inicio}>Volver a mi panel</Enlace>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-6">
      {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
      {obligatorio ? (
        <Aviso tono="neutro">
          Las cuentas de administrador deben tener el segundo factor activo antes de entrar al
          panel.
        </Aviso>
      ) : null}
      <p className="text-niebla">
        Ten a mano tu celular con la app instalada. Toma menos de un minuto.
      </p>
      <BotonEnviar enviando="Preparando…" className="justify-self-start">
        Empezar
      </BotonEnviar>
      {obligatorio ? null : (
        <Enlace href={inicio} gris>
          Ahora no
        </Enlace>
      )}
    </form>
  );
}

function CodigosDeRecuperacion({ codigos, inicio }: { codigos: string[]; inicio: string }) {
  const [guardados, setGuardados] = useState(false);
  const textoPlano = `Códigos de recuperación de DocTraderPRO\nCada uno sirve una sola vez.\n\n${codigos.join('\n')}\n`;

  const [descarga, setDescarga] = useEstadoAccion();
  const [copia, setCopia] = useEstadoAccion();

  return (
    <div className="grid gap-6">
      <Aviso tono="exito">Listo: el segundo factor quedó activo.</Aviso>
      <h2 className="text-medio">Guarda tus códigos de recuperación.</h2>
      <p className="text-niebla">
        Si pierdes el celular, cada código te deja ingresar una vez. Guárdalos en tu gestor de
        contraseñas o en papel, lejos del celular. No los volverás a ver aquí.
      </p>
      <ol
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-pildora bg-campo px-6 py-5 cifra text-[17px] text-blanco select-all"
        translate="no"
      >
        {codigos.map((codigo) => (
          <li key={codigo}>{codigo}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-8">
        <BotonAccion
          variante="enlace"
          estado={descarga}
          textos={{
            normal: 'Descargar como archivo',
            procesando: 'Preparando…',
            exito: 'Archivo descargado',
            error: 'No se pudo descargar: cópialos',
          }}
          onClick={() =>
            setDescarga(
              descargarContenido(
                textoPlano,
                'doctraderpro-codigos-de-recuperacion.txt',
                'text/plain;charset=utf-8',
              )
                ? 'exito'
                : 'error',
            )
          }
        />
        <BotonAccion
          variante="enlace"
          estado={copia}
          textos={{
            normal: 'Copiar',
            procesando: 'Copiando…',
            exito: '¡Copiados!',
            error: 'No se copiaron: selecciónalos',
          }}
          onClick={async () => {
            setCopia('procesando');
            setCopia((await copiarTexto(textoPlano)) ? 'exito' : 'error');
          }}
        />
      </div>
      <Casilla checked={guardados} onChange={(e) => setGuardados(e.currentTarget.checked)}>
        Ya guardé mis códigos en un lugar seguro.
      </Casilla>
      <Pildora
        href={inicio}
        className="justify-self-start"
        aria-disabled={!guardados}
        tabIndex={guardados ? undefined : -1}
        style={guardados ? undefined : { pointerEvents: 'none', opacity: 0.4 }}
      >
        Ir a mi panel
      </Pildora>
    </div>
  );
}
