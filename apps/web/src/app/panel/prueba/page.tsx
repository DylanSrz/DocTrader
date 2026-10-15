import { formatearTelefono } from '@doctrader/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { BotonOrden } from '@/components/panel/ordenes';
import { Enlace, Etiqueta, Triangulo } from '@/components/ui';
import { fechaLarga, usd } from '@/lib/formato';
import { type EstadoPrueba, leerPanel } from '@/lib/panel';
import { requerirSesion } from '@/lib/sesion';
import { SolicitarPrueba, VerificarTelefono } from './formularios';

export const metadata: Metadata = { title: 'Prueba de 15 días' };

/** Un paso de la solicitud: el triángulo lleno cuando ya está hecho. */
function Paso({
  numero,
  titulo,
  hecho,
  children,
}: {
  numero: number;
  titulo: string;
  hecho: boolean;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,4fr)_minmax(0,7fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-5 max-md:grid-cols-1">
      <div className="flex items-baseline gap-4">
        <Triangulo relleno={hecho} tamano={12} className={hecho ? 'text-senal' : 'text-ceniza'} />
        <h2 className="text-medio">
          <span className="sr-only">Paso {numero}: </span>
          {titulo}
          {hecho ? <span className="sr-only"> (hecho)</span> : null}
        </h2>
      </div>
      <div className="grid justify-items-start gap-4">{children}</div>
    </li>
  );
}

async function Contenido() {
  await requerirSesion('CLIENT');
  const prueba = await leerPanel<EstadoPrueba>('/prueba');
  const dias = prueba.dias ?? 15;
  const precio = prueba.precioUsdCentavos ? usd(prueba.precioUsdCentavos) : 'USD 50';
  const s = prueba.solicitud;
  const vigente = s && (s.estado === 'PENDIENTE' || s.estado === 'APROBADA');

  let titulo = `Prueba de ${dias} días por ${precio}.`;
  let texto: ReactNode = (
    <>
      Conectamos tu cuenta al copy trading durante {dias} días. Si te gusta, pagas solo la
      diferencia del plan que elijas y tus {dias} días cuentan dentro de él. Es una sola vez por
      persona y por cuenta de trading, y revisamos cada solicitud.
    </>
  );
  let accion: ReactNode = null;

  if (s?.estado === 'PENDIENTE') {
    titulo = 'Estamos revisando tu solicitud.';
    texto = (
      <>
        Pediste la prueba para la cuenta <span className="cifra">{s.cuenta.numero}</span> el{' '}
        {fechaLarga(s.creadaEn)}. Te escribimos por correo apenas la revisemos.
      </>
    );
  } else if (s?.estado === 'APROBADA' && s.orden?.estado === 'APROBADA') {
    titulo = 'Tu prueba está en curso.';
    texto = 'Puedes ver los días que te quedan y completarla desde tus cuentas.';
    accion = <Enlace href="/panel">Ir a mis cuentas</Enlace>;
  } else if (s?.estado === 'APROBADA') {
    titulo = 'Aprobamos tu prueba.';
    texto = (
      <>
        Paga {precio} en USDT o BTC para la cuenta <span className="cifra">{s.cuenta.numero}</span>.
        Apenas verifiquemos el pago, conectamos la cuenta; los {dias} días cuentan desde ese
        momento.
      </>
    );
    accion =
      s.orden && (s.orden.estado === 'PENDIENTE' || s.orden.estado === 'REPORTADA') ? (
        <Enlace href={`/panel/pagos?orden=${s.orden.numero}`}>
          {s.orden.estado === 'REPORTADA' ? 'Ver el pago' : 'Ir a pagar'}
        </Enlace>
      ) : (
        <BotonOrden cuentaId={s.cuentaId} plan="PRUEBA" variante="pildora">
          {`Pagar la prueba (${precio})`}
        </BotonOrden>
      );
  } else if (s?.estado === 'RECHAZADA') {
    titulo = 'No pudimos aprobar tu prueba.';
    texto = s.motivoRechazo
      ? `Motivo: ${s.motivoRechazo}`
      : 'Escríbenos a soporte si quieres saber más.';
    accion = <Enlace href="/panel">Comprar una licencia</Enlace>;
  } else if (s?.estado === 'BLOQUEADA') {
    titulo = 'Ya usaste la prueba.';
    texto = (
      <>
        {s.motivos.join(' ')} La prueba es una sola vez por persona y por cuenta de trading. Puedes
        comprar una licencia mensual o semestral desde tus cuentas.
      </>
    );
    accion = <Enlace href="/panel">Ir a mis cuentas</Enlace>;
  } else if (!prueba.disponible) {
    titulo = 'Por ahora no estamos recibiendo solicitudes de prueba.';
    texto = 'Puedes comprar una licencia mensual o semestral, o escribirnos a soporte.';
    accion = <Enlace href="/panel">Ir a mis cuentas</Enlace>;
  }

  const pedir = prueba.disponible && !vigente && s?.estado !== 'BLOQUEADA';

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Prueba</Etiqueta>
        <h1 className={titulo.length > 40 ? 'text-grande' : 'text-display'}>{titulo}</h1>
        <p className="max-w-[36em] text-blanco">{texto}</p>
        {accion ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{accion}</div>
        ) : null}
      </div>

      {pedir ? (
        <ol
          aria-label="Pasos para pedir la prueba"
          className="mt-[clamp(72px,9vw,120px)] grid gap-[clamp(56px,7vw,88px)]"
        >
          <Paso numero={1} titulo="Tu correo" hecho={prueba.correoVerificado}>
            <p className="text-[15px] text-niebla">
              {prueba.correoVerificado
                ? 'Verificado.'
                : 'Confirma tu correo con el enlace que te enviamos al registrarte.'}
            </p>
          </Paso>
          <Paso numero={2} titulo="Tu teléfono" hecho={prueba.telefonoVerificado}>
            {prueba.telefonoVerificado ? (
              <p className="text-[15px] text-niebla">
                Verificado: <span className="cifra">{formatearTelefono(prueba.telefono!)}</span>.
              </p>
            ) : prueba.telefono ? (
              <>
                <p className="max-w-[34em] text-[15px] text-niebla">
                  Te enviamos un código por SMS al{' '}
                  <span className="cifra text-blanco">{formatearTelefono(prueba.telefono)}</span>.
                  Si el número está mal, escríbenos a soporte antes de pedirlo.
                </p>
                <VerificarTelefono telefono={formatearTelefono(prueba.telefono)} />
              </>
            ) : (
              <p className="text-[15px] text-niebla">
                Tu cuenta no tiene teléfono. Escríbenos a soporte para agregarlo.
              </p>
            )}
          </Paso>
          <Paso numero={3} titulo="La cuenta de trading" hecho={false}>
            {prueba.cuentas.length > 0 ? (
              <SolicitarPrueba
                cuentas={prueba.cuentas}
                habilitada={prueba.correoVerificado && prueba.telefonoVerificado}
              />
            ) : (
              <>
                <p className="max-w-[34em] text-[15px] text-niebla">
                  Agrega primero la cuenta de trading que quieres probar, con sus contraseñas.
                  Durante la prueba no se pueden cambiar su broker, su servidor ni su número.
                </p>
                <Enlace href="/panel">Agregar la cuenta</Enlace>
              </>
            )}
          </Paso>
        </ol>
      ) : null}
    </>
  );
}

export default function PruebaPagina() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
