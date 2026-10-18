import { NOMBRE_TEMA, TEMA_TICKET } from '@doctrader/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode, Suspense } from 'react';
import { CorreoSoporte } from '@/components/correo-soporte';
import { LateralAbierto } from '@/components/panel/lateral';
import { Hilo } from '@/components/soporte/hilo';
import { Enlace, Estado, Etiqueta, Pildora, cx } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { fechaLarga } from '@/lib/formato';
import { leerPanel } from '@/lib/panel';
import { obtenerLanding } from '@/lib/publico';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { cuando, ESTADO_TICKET_CLIENTE, type MisTickets, type TicketCliente } from '@/lib/soporte';
import { NuevoTicket, Responder } from './formularios';

export const metadata: Metadata = { title: 'Soporte' };

type Parametros = Promise<{ ticket?: string; nuevo?: string; tema?: string; cuenta?: string }>;

/** Lo que dice el ticket sobre su estado, debajo del hilo. */
function NotaEstado({ ticket, diasCierre }: { ticket: TicketCliente; diasCierre: number }) {
  if (ticket.estado === 'CERRADO') {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-[15px] text-niebla">
          Este ticket se cerró{ticket.cerradoEn ? ` el ${fechaLarga(ticket.cerradoEn)}` : ''}. Si
          necesitas algo más, abre uno nuevo.
        </p>
        <Enlace href="/panel/soporte?nuevo=1" scroll={false}>
          Abrir un ticket nuevo
        </Enlace>
      </div>
    );
  }
  if (ticket.estado === 'RESUELTO') {
    return (
      <p className="text-[15px] text-niebla">
        Este ticket está resuelto.{' '}
        {ticket.cierraEn
          ? `Si el problema volvió, escríbenos aquí antes del ${fechaLarga(ticket.cierraEn)}: después se cierra solo.`
          : `Si el problema volvió, escríbenos aquí: se cierra solo ${diasCierre} días después de resuelto.`}
      </p>
    );
  }
  return null;
}

async function Contenido({ parametros }: { parametros: Parametros }) {
  await requerirSesion('CLIENT');
  const { ticket: numeroCrudo, nuevo, tema, cuenta } = await parametros;
  const numero = numeroCrudo && /^\d{1,9}$/.test(numeroCrudo) ? numeroCrudo : null;
  const token = await tokenDeSesion();
  const [lista, ticket, landing] = await Promise.all([
    leerPanel<MisTickets>('/soporte'),
    numero ? llamarApi<TicketCliente>(`/soporte/${numero}`, { token }) : Promise.resolve(null),
    obtenerLanding(),
  ]);
  const { tickets } = lista;
  const respondido = tickets.find((t) => t.estado === 'RESPONDIDO');
  const abiertos = tickets.filter((t) => t.estado === 'ABIERTO');

  let titulo = '¿En qué te ayudamos?';
  let texto: ReactNode = (
    <>
      Abre un ticket y te respondemos aquí y por correo. Para dudas rápidas, escríbenos por{' '}
      <span translate="no">Telegram</span>.
    </>
  );
  let principal: ReactNode = (
    <Pildora href="/panel/soporte?nuevo=1" scroll={false}>
      Abrir un ticket
    </Pildora>
  );
  if (respondido) {
    const varios = tickets.filter((t) => t.estado === 'RESPONDIDO').length;
    titulo = varios > 1 ? `Respondimos ${varios} de tus tickets.` : 'Respondimos tu ticket.';
    texto = (
      <>
        {varios > 1 ? 'El más reciente: ' : 'Sobre '}«{respondido.asunto}». También te llegó por
        correo.
      </>
    );
    principal = (
      <Pildora href={`/panel/soporte?ticket=${respondido.numero}`} scroll={false}>
        Ver la respuesta
      </Pildora>
    );
  } else if (abiertos.length > 0) {
    titulo =
      abiertos.length === 1
        ? 'Estamos revisando tu ticket.'
        : `Estamos revisando tus ${abiertos.length} tickets.`;
    texto = 'Te escribimos aquí y por correo apenas tengamos una respuesta.';
    principal = null;
  }

  // Abrir un ticket desde otra vista: `?nuevo=1&tema=PAGOS&cuenta=<id>`.
  const temaInicial = Object.values(TEMA_TICKET).includes(tema as never) ? tema : undefined;
  const cuentaInicial = lista.cuentas.find((c) => c.id === cuenta)?.id;

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Soporte</Etiqueta>
        <h1 className="text-grande">{titulo}</h1>
        <p className="max-w-[36em] text-blanco">{texto}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {principal}
          {respondido || !principal ? (
            <Enlace href="/panel/soporte?nuevo=1" scroll={false}>
              {principal ? 'Abrir un ticket nuevo' : 'Abrir otro ticket'}
            </Enlace>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="t-tickets" className="mt-[clamp(72px,9vw,120px)]">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 id="t-tickets" className="text-medio">
            Tus tickets
          </h2>
          <p className="text-sm text-ceniza">
            Para dudas rápidas:{' '}
            <a
              href={landing.enlaces.telegram}
              target="_blank"
              rel="noopener"
              translate="no"
              className="underline decoration-white/35 underline-offset-4 hover:text-blanco"
            >
              Telegram
            </a>{' '}
            o <CorreoSoporte correo={landing.correoSoporte} />
          </p>
        </div>
        {tickets.length > 0 ? (
          <ol className="grid">
            {tickets.map((t) => {
              const e = ESTADO_TICKET_CLIENTE[t.estado];
              return (
                <li key={t.id} className="border-t border-white/8 first:border-t-0">
                  <Link
                    id={`ticket-${t.numero}`}
                    href={`/panel/soporte?ticket=${t.numero}`}
                    scroll={false}
                    className={cx(
                      'group grid grid-cols-[minmax(150px,auto)_minmax(0,1fr)_auto] items-center gap-x-8 gap-y-1 py-[22px] [grid-template-areas:"estado_asunto_cuando""estado_meta_cuando"] max-md:grid-cols-1 max-md:gap-y-2 max-md:[grid-template-areas:"estado""asunto""meta""cuando"]',
                      String(t.numero) === numero && 'bg-white/[0.03]',
                    )}
                  >
                    <span className="justify-self-start [grid-area:estado]">
                      <Estado tono={e.tono}>{e.texto}</Estado>
                    </span>
                    <span className="text-[clamp(20px,2vw,26px)] tracking-[-0.02em] transition-colors duration-200 [grid-area:asunto] [overflow-wrap:anywhere] group-hover:text-llama">
                      {t.asunto}
                    </span>
                    <span className="text-sm text-ceniza [grid-area:meta]">
                      Ticket {t.numero}, {NOMBRE_TEMA[t.tema].toLowerCase()}
                      {t.cuenta ? `, cuenta ${t.cuenta}` : t.orden ? `, orden ${t.orden}` : ''}
                    </span>
                    <time
                      dateTime={t.ultimoMensaje}
                      className="cifra text-sm text-ceniza [grid-area:cuando]"
                    >
                      {cuando(t.ultimoMensaje)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-niebla">Todavía no has abierto tickets.</p>
        )}
      </section>

      {ticket?.ok ? (
        <LateralAbierto
          key={`ticket-${ticket.datos.numero}`}
          titulo={ticket.datos.asunto}
          subtitulo={`Ticket ${ticket.datos.numero}, ${NOMBRE_TEMA[ticket.datos.tema].toLowerCase()}${
            ticket.datos.cuenta
              ? `, cuenta ${ticket.datos.cuenta.numero}`
              : ticket.datos.orden
                ? `, orden ${ticket.datos.orden.numero}`
                : ''
          }`}
          cerrarEn="/panel/soporte"
          idOrigen={`ticket-${ticket.datos.numero}`}
        >
          <div className="grid justify-items-start gap-3">
            <Estado tono={ESTADO_TICKET_CLIENTE[ticket.datos.estado].tono}>
              {ESTADO_TICKET_CLIENTE[ticket.datos.estado].texto}
            </Estado>
          </div>
          <Hilo mensajes={ticket.datos.mensajes} />
          <NotaEstado ticket={ticket.datos} diasCierre={lista.diasCierre} />
          {ticket.datos.estado === 'CERRADO' ? null : (
            <Responder
              numero={ticket.datos.numero}
              estadoTicket={ticket.datos.estado}
              adjuntos={ticket.datos.adjuntos}
            />
          )}
        </LateralAbierto>
      ) : nuevo ? (
        <LateralAbierto key="nuevo" titulo="Abrir un ticket" cerrarEn="/panel/soporte">
          <NuevoTicket
            cuentas={lista.cuentas}
            ordenes={lista.ordenes}
            adjuntos={lista.adjuntos}
            inicial={{
              tema: temaInicial,
              relacion: cuentaInicial ? `cuenta:${cuentaInicial}` : '',
            }}
          />
        </LateralAbierto>
      ) : null}
    </>
  );
}

export default function SoportePagina({ searchParams }: { searchParams: Parametros }) {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tus tickets…</p>}>
      <Contenido parametros={searchParams} />
    </Suspense>
  );
}
