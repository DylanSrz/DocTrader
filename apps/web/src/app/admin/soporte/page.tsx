import { NOMBRE_TEMA, TEMA_TICKET, type TemaTicket } from '@doctrader/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LateralAbierto } from '@/components/panel/lateral';
import { Hilo } from '@/components/soporte/hilo';
import { Enlace, Estado, Etiqueta, Pildora, cx } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { fechaLarga } from '@/lib/formato';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import {
  type Bandeja,
  duracion,
  ESTADO_TICKET_ADMIN,
  NOMBRE_VISTA,
  type TicketAdmin,
  tiempoDesde,
  type VistaBandeja,
} from '@/lib/soporte';
import { AjustesTicket, ResolverAdmin, ResponderAdmin } from './formularios';

export const metadata: Metadata = { title: 'Soporte' };

type Parametros = Promise<{ vista?: string; tema?: string; ticket?: string }>;

const VISTAS: VistaBandeja[] = ['sin', 'abiertos', 'resueltos', 'todos'];
/** La hora de esta petición (la página es dinámica: se arma en cada visita). */
function horaDeLaPeticion(): number {
  return Date.now();
}

/** Un ticket sin responder por más de esto se marca en naranja. */
const HORAS_TARDE = 4;

function enlace(vista: VistaBandeja, tema?: TemaTicket, ticket?: number): string {
  const p = new URLSearchParams();
  if (vista !== 'sin') p.set('vista', vista);
  if (tema) p.set('tema', tema);
  if (ticket) p.set('ticket', String(ticket));
  const t = p.toString();
  return t ? `/admin/soporte?${t}` : '/admin/soporte';
}

const clasesFiltro =
  'inline-flex min-h-10 items-center gap-2 rounded-pildora bg-campo px-4 py-2 text-sm font-medium text-niebla transition-colors duration-200 hover:bg-campo-foco hover:text-blanco aria-[current=true]:bg-blanco aria-[current=true]:text-vacio';

function FichaTicket({ t }: { t: TicketAdmin }) {
  const estado = ESTADO_TICKET_ADMIN[t.estado];
  const cerrado = t.estado === 'CERRADO';
  return (
    <>
      <div className="grid justify-items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Estado tono={estado.tono}>{estado.texto}</Estado>
          {t.prioridad === 'ALTA' ? <Estado tono="error">Prioridad alta</Estado> : null}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[15px]">
          <dt className="text-ceniza">Cliente</dt>
          <dd className="[overflow-wrap:anywhere]">
            {t.cliente.nombre} ·{' '}
            <a
              href={`mailto:${t.cliente.correo}`}
              className="underline decoration-white/35 underline-offset-4 hover:decoration-current"
            >
              {t.cliente.correo}
            </a>
          </dd>
          {t.cuenta ? (
            <>
              <dt className="text-ceniza">Cuenta</dt>
              <dd>
                <span className="cifra">{t.cuenta.numero}</span>{' '}
                <span className="text-ceniza" translate="no">
                  {t.cuenta.broker}
                </span>
              </dd>
            </>
          ) : null}
          {t.orden ? (
            <>
              <dt className="text-ceniza">Orden</dt>
              <dd className="cifra">{t.orden.numero}</dd>
            </>
          ) : null}
          <dt className="text-ceniza">Abierto</dt>
          <dd>{fechaLarga(t.creadoEn)}</dd>
          {t.cierraEn ? (
            <>
              <dt className="text-ceniza">Se cierra</dt>
              <dd>{fechaLarga(t.cierraEn)}, si el cliente no responde</dd>
            </>
          ) : null}
        </dl>
      </div>

      {cerrado ? null : (
        <AjustesTicket
          numero={t.numero}
          asignadoA={t.asignadoA}
          prioridad={t.prioridad}
          admins={t.admins}
        />
      )}

      <Hilo mensajes={t.mensajes} />

      {cerrado ? (
        <p className="text-[15px] text-niebla">
          Este ticket se cerró{t.cerradoEn ? ` el ${fechaLarga(t.cerradoEn)}` : ''}. Si el cliente
          necesita algo más, abre un ticket nuevo.
        </p>
      ) : (
        <div className="grid gap-4">
          <ResponderAdmin numero={t.numero} respuestas={t.respuestas} adjuntos={t.adjuntos} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            {t.estado === 'RESUELTO' ? null : <ResolverAdmin numero={t.numero} />}
            <Enlace href="/admin/respuestas" gris>
              Editar respuestas guardadas
            </Enlace>
          </div>
        </div>
      )}
    </>
  );
}

async function Contenido({ parametros }: { parametros: Parametros }) {
  await requerirSesion('ADMIN');
  const { vista: vistaCruda, tema: temaCrudo, ticket: numeroCrudo } = await parametros;
  const vista = VISTAS.includes(vistaCruda as VistaBandeja) ? (vistaCruda as VistaBandeja) : 'sin';
  const tema = Object.values(TEMA_TICKET).includes(temaCrudo as TemaTicket)
    ? (temaCrudo as TemaTicket)
    : undefined;
  const numero = numeroCrudo && /^\d{1,9}$/.test(numeroCrudo) ? Number(numeroCrudo) : undefined;
  const token = await tokenDeSesion();
  const consulta = new URLSearchParams({ vista, ...(tema ? { tema } : {}) });
  const [bandeja, ticket] = await Promise.all([
    llamarApi<Bandeja>(`/admin/soporte?${consulta}`, { token }),
    numero ? llamarApi<TicketAdmin>(`/admin/soporte/${numero}`, { token }) : Promise.resolve(null),
  ]);
  if (!bandeja.ok) {
    return <p className="text-error">No pudimos cargar los tickets: {bandeja.error.mensaje}</p>;
  }
  const b = bandeja.datos;
  const sin = b.conteos.sin;
  const ahora = horaDeLaPeticion();

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Soporte</Etiqueta>
        <h1 className="text-grande">
          {sin === 0
            ? 'Ningún ticket espera respuesta.'
            : sin === 1
              ? '1 ticket espera respuesta.'
              : `${sin} tickets esperan respuesta.`}
        </h1>
        <p className="max-w-[36em] text-blanco">
          {b.masAntiguo && sin > 0
            ? `El más antiguo lleva ${tiempoDesde(b.masAntiguo, ahora)}. `
            : ''}
          {b.primeraRespuestaMinutos !== null
            ? `Esta semana la primera respuesta tardó ${duracion(b.primeraRespuestaMinutos)} en promedio.`
            : 'Al responder, al cliente le llega un correo; las notas internas solo las ven los admins.'}
        </p>
        {b.siguiente ? (
          <Pildora href={enlace(vista, tema, b.siguiente)} scroll={false}>
            Responder el más antiguo
          </Pildora>
        ) : null}
      </div>

      <section aria-label="Bandeja de tickets" className="mt-[clamp(56px,7vw,96px)]">
        <nav aria-label="Filtrar tickets" className="mb-3 flex flex-wrap gap-2">
          {VISTAS.map((v) => (
            <Link
              key={v}
              href={enlace(v, tema)}
              scroll={false}
              aria-current={v === vista ? 'true' : undefined}
              className={clasesFiltro}
            >
              {NOMBRE_VISTA[v]}
              <small className="cifra text-xs opacity-75">{b.conteos[v]}</small>
            </Link>
          ))}
        </nav>
        <nav aria-label="Filtrar por tema" className="mb-6 flex flex-wrap gap-x-5 gap-y-1">
          {[undefined, ...Object.values(TEMA_TICKET)].map((t) => (
            <Link
              key={t ?? 'todos'}
              href={enlace(vista, t)}
              scroll={false}
              aria-current={t === tema ? 'true' : undefined}
              className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-transparent underline-offset-[6px] transition-colors duration-200 hover:text-blanco aria-[current=true]:text-blanco aria-[current=true]:decoration-white/35"
            >
              {t ? NOMBRE_TEMA[t] : 'Todos los temas'}
            </Link>
          ))}
        </nav>

        {b.tickets.length > 0 ? (
          <ol className="grid">
            {b.tickets.map((t) => {
              const e = ESTADO_TICKET_ADMIN[t.estado];
              const tarde =
                t.estado === 'ABIERTO' &&
                ahora - new Date(t.esperaDesde).getTime() > HORAS_TARDE * 3_600_000;
              return (
                <li key={t.id} className="border-t border-white/8 first:border-t-0">
                  <Link
                    id={`ticket-${t.numero}`}
                    href={enlace(vista, tema, t.numero)}
                    scroll={false}
                    className={cx(
                      'group grid grid-cols-[minmax(170px,auto)_minmax(0,1fr)_auto] items-center gap-x-8 gap-y-1 py-[22px] [grid-template-areas:"estado_asunto_espera""estado_meta_asignado"] max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-2 max-md:[grid-template-areas:"estado_espera""asunto_asunto""meta_asignado"]',
                      t.numero === numero && 'bg-white/[0.03]',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2 justify-self-start [grid-area:estado]">
                      <Estado tono={e.tono}>{e.texto}</Estado>
                    </span>
                    <span className="text-[clamp(20px,2vw,26px)] tracking-[-0.02em] transition-colors duration-200 [grid-area:asunto] [overflow-wrap:anywhere] group-hover:text-llama">
                      {t.prioridad === 'ALTA' ? (
                        <span className="mr-2 align-middle text-sm font-medium text-error">
                          Alta
                        </span>
                      ) : null}
                      {t.asunto}
                    </span>
                    <span className="text-sm text-ceniza [grid-area:meta]">
                      {t.cliente}, {NOMBRE_TEMA[t.tema].toLowerCase()}
                      {t.cuenta ? `, cuenta ${t.cuenta}` : ''}, ticket {t.numero}
                    </span>
                    <span
                      className={cx(
                        'cifra justify-self-end text-sm [grid-area:espera]',
                        tarde ? 'text-llama' : 'text-blanco',
                      )}
                    >
                      {t.estado === 'ABIERTO'
                        ? `Espera hace ${tiempoDesde(t.esperaDesde, ahora)}`
                        : t.estado === 'RESPONDIDO'
                          ? 'Espera al cliente'
                          : tiempoDesde(t.ultimoMensaje, ahora)}
                    </span>
                    <span className="justify-self-end text-[13px] text-ceniza [grid-area:asignado]">
                      {t.asignado ?? 'Sin asignar'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-niebla">No hay tickets en esta lista.</p>
        )}
      </section>

      {ticket?.ok ? (
        <LateralAbierto
          key={`ticket-${ticket.datos.numero}`}
          titulo={ticket.datos.asunto}
          subtitulo={`Ticket ${ticket.datos.numero} de ${ticket.datos.cliente.nombre}, ${NOMBRE_TEMA[
            ticket.datos.tema
          ].toLowerCase()}`}
          cerrarEn={enlace(vista, tema)}
          idOrigen={`ticket-${ticket.datos.numero}`}
        >
          <FichaTicket t={ticket.datos} />
        </LateralAbierto>
      ) : null}
    </>
  );
}

export default function SoporteAdmin({ searchParams }: { searchParams: Parametros }) {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando los tickets…</p>}>
      <Contenido parametros={searchParams} />
    </Suspense>
  );
}
