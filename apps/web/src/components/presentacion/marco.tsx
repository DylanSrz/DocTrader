import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import logo from '../../../public/marca/logo-icon.png';

/** Un elemento que entra con la diapositiva; `orden` escalona la entrada. */
export function Entra({
  orden = 0,
  className,
  children,
}: {
  orden?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`entra ${className ?? ''}`} style={{ '--i': orden } as CSSProperties}>
      {children}
    </div>
  );
}

/** Marco de cada diapositiva: la marca arriba, el tema de la diapositiva y el contenido. */
export function Marco({ tema, children }: { tema?: string; children: ReactNode }) {
  return (
    <div className="diapositiva-marco">
      <div className="diapositiva-cabeza">
        <span className="inline-flex items-center gap-[1.4cqmin]">
          <Image src={logo} alt="" className="h-[4.2cqmin] w-auto" />
          <span className="font-semibold tracking-[-0.02em]" translate="no">
            DocTraderPRO
          </span>
        </span>
        {tema ? <span className="text-ceniza">{tema}</span> : null}
      </div>
      <div className="diapositiva-cuerpo">{children}</div>
    </div>
  );
}

/** Lista de puntos (título y texto) en columnas, rejilla de 2 o pasos numerados. */
export function Puntos({
  puntos,
  forma = 'p-columnas',
  desde = 1,
}: {
  puntos: readonly (readonly [string, ReactNode])[];
  forma?: 'p-columnas' | 'p-rejilla';
  desde?: number;
}) {
  return (
    <ul className={forma}>
      {puntos.map(([titulo, texto], i) => (
        <li key={titulo}>
          <Entra orden={i + desde} className="grid gap-[1.4cqmin]">
            <h3 className="p-subtitulo">{titulo}</h3>
            <p className="p-texto text-niebla">{texto}</p>
          </Entra>
        </li>
      ))}
    </ul>
  );
}
