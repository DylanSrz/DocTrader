import { cx } from '@/components/ui';
import { cuando, type MensajeVista, tamanoArchivo } from '@/lib/soporte';

/**
 * El hilo de un ticket, del más viejo al más nuevo. Los mensajes del equipo llevan el triángulo naranja; las notas
 * internas (solo admins) van sobre fondo verde limón. El texto es plano: React lo escapa y se respetan los saltos.
 */
export function Hilo({ mensajes }: { mensajes: MensajeVista[] }) {
  return (
    <ol aria-label="Mensajes" className="grid gap-7">
      {mensajes.map((m) => (
        <li
          key={m.id}
          className={cx(
            'grid gap-1.5',
            m.interna
              ? 'rounded-[16px] bg-senal/8 px-4 py-3.5'
              : m.deEquipo
                ? undefined
                : 'border-l border-white/12 pl-4',
          )}
        >
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
            <b
              className={cx(
                'font-medium',
                m.interna ? 'text-senal' : 'text-blanco',
                m.deEquipo &&
                  !m.interna &&
                  "before:mr-2 before:inline-block before:h-[7px] before:w-2 before:bg-llama before:[clip-path:polygon(50%_0,100%_100%,0_100%)] before:content-['']",
              )}
            >
              {m.interna ? `Nota interna de ${m.autor}` : m.autor}
            </b>
            <time dateTime={m.creadoEn} className="text-ceniza">
              {cuando(m.creadoEn)}
            </time>
          </p>
          <p
            className={cx(
              'text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]',
              m.deEquipo ? 'text-blanco' : 'text-niebla',
            )}
          >
            {m.texto}
          </p>
          {m.adjuntos.length > 0 ? (
            <ul aria-label="Adjuntos" className="mt-1 flex flex-wrap gap-2">
              {m.adjuntos.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/archivo/${a.id}`}
                    className="inline-flex min-h-9 max-w-[18rem] items-center gap-2 rounded-pildora bg-campo px-3.5 text-[13px] text-niebla transition-colors duration-200 hover:bg-campo-foco hover:text-blanco"
                  >
                    <svg aria-hidden="true" viewBox="0 0 12 14" className="size-3 shrink-0">
                      <path
                        d="M6 1v8m0 0L2.5 5.5M6 9l3.5-3.5M1 13h10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    </svg>
                    <span className="truncate">{a.nombre}</span>
                    <span className="shrink-0 text-ceniza">{tamanoArchivo(a.tamano)}</span>
                    <span className="sr-only">(descargar)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
