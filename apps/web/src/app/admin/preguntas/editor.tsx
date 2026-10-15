'use client';

import { LIMITES_PREGUNTAS, type PreguntaFrecuente } from '@doctrader/shared';
import { useActionState, useId, useState, useTransition } from 'react';
import { Aviso, Pildora } from '@/components/ui';
import { type EstadoGuardado, guardarPreguntas } from '../acciones';

interface Fila extends PreguntaFrecuente {
  clave: string;
}

const claseCampo =
  'w-full rounded-[16px] bg-campo px-5 py-3.5 text-base font-normal text-blanco transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none';
const claseBoton =
  'inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] transition-colors hover:text-blanco hover:decoration-current disabled:pointer-events-none disabled:opacity-30';

/** Editor de las preguntas frecuentes: agregar, quitar, reordenar y guardar todas juntas. */
export function EditorPreguntas({ iniciales }: { iniciales: PreguntaFrecuente[] }) {
  const base = useId();
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.map((p, i) => ({ ...p, clave: `${base}-${i}` })),
  );
  const [contador, setContador] = useState(iniciales.length);
  const [cambios, setCambios] = useState(false);
  const [estado, guardar] = useActionState(guardarPreguntas, {} as EstadoGuardado);
  const [guardando, iniciar] = useTransition();
  const [ultimoGuardado, setUltimoGuardado] = useState(0);

  if ((estado.guardado ?? 0) !== ultimoGuardado) {
    setUltimoGuardado(estado.guardado ?? 0);
    setCambios(false);
  }

  function cambiar(indice: number, campo: 'pregunta' | 'respuesta', valor: string) {
    setFilas((actual) => actual.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));
    setCambios(true);
  }

  function mover(indice: number, paso: -1 | 1) {
    setFilas((actual) => {
      const copia = [...actual];
      const [fila] = copia.splice(indice, 1);
      copia.splice(indice + paso, 0, fila!);
      return copia;
    });
    setCambios(true);
  }

  function quitar(indice: number) {
    setFilas((actual) => actual.filter((_, i) => i !== indice));
    setCambios(true);
  }

  function agregar() {
    setFilas((actual) => [
      ...actual,
      { pregunta: '', respuesta: '', clave: `${base}-n${contador}` },
    ]);
    setContador((c) => c + 1);
    setCambios(true);
  }

  return (
    <form
      className="grid gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(() => guardar(filas.map(({ pregunta, respuesta }) => ({ pregunta, respuesta }))));
      }}
    >
      <ol className="grid gap-10">
        {filas.map((fila, i) => (
          <li key={fila.clave} className="grid max-w-[46rem] gap-3">
            <div className="flex items-center justify-between gap-4">
              <span className="texto-menu text-ceniza">Pregunta {i + 1}</span>
              <div className="flex gap-5">
                <button
                  type="button"
                  className={claseBoton}
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className={claseBoton}
                  onClick={() => mover(i, 1)}
                  disabled={i === filas.length - 1}
                >
                  Bajar
                </button>
                <button type="button" className={claseBoton} onClick={() => quitar(i)}>
                  Quitar
                </button>
              </div>
            </div>
            <label className="sr-only" htmlFor={`${fila.clave}-p`}>
              Pregunta {i + 1}
            </label>
            <input
              id={`${fila.clave}-p`}
              className={`${claseCampo} min-h-[52px] rounded-pildora`}
              value={fila.pregunta}
              maxLength={LIMITES_PREGUNTAS.pregunta}
              placeholder="¿Cuál es la pregunta?"
              onChange={(e) => cambiar(i, 'pregunta', e.target.value)}
            />
            <label className="sr-only" htmlFor={`${fila.clave}-r`}>
              Respuesta {i + 1}
            </label>
            <textarea
              id={`${fila.clave}-r`}
              className={`${claseCampo} min-h-28 resize-y leading-[1.5]`}
              value={fila.respuesta}
              maxLength={LIMITES_PREGUNTAS.respuesta}
              placeholder="La respuesta"
              onChange={(e) => cambiar(i, 'respuesta', e.target.value)}
            />
          </li>
        ))}
      </ol>
      <div>
        <button
          type="button"
          onClick={agregar}
          disabled={filas.length >= LIMITES_PREGUNTAS.maximo}
          className={claseBoton}
        >
          Agregar una pregunta
        </button>
      </div>
      <div className="sticky bottom-0 -mx-4 grid gap-4 bg-vacio/90 px-4 py-4 backdrop-blur-sm">
        {estado.error ? <Aviso>{estado.error}</Aviso> : null}
        {!cambios && estado.guardado ? (
          <Aviso tono="exito">Guardado. La landing ya muestra las preguntas nuevas.</Aviso>
        ) : null}
        <Pildora type="submit" disabled={guardando || !cambios} className="justify-self-start">
          {guardando ? 'Guardando…' : 'Guardar preguntas'}
        </Pildora>
      </div>
    </form>
  );
}
