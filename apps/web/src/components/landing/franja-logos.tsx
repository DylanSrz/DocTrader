import { cx } from '@/components/ui';
import { type LogoCompatible, LOGOS_COMPATIBLES } from './logos-compatibles';

/*
  Franja infinita de logos, solo con CSS (estilos `.franja-logos` en globals.css).
  - La pista lleva dos mitades idénticas y se desplaza exactamente la mitad de su ancho: al terminar, la segunda mitad
    queda donde empezó la primera y el salto no se ve.
  - Cada mitad repite la lista las veces necesarias para cubrir pantallas anchas sin huecos.
  - Solo la primera copia la leen los lectores de pantalla; las demás van con aria-hidden.
  - Con "reducir movimiento" no se mueve: se ve una sola copia, centrada y en varias filas si hace falta.
*/

const REPETICIONES = 3;

function Logo({ logo, oculto }: { logo: LogoCompatible; oculto: boolean }) {
  return (
    <li className="franja-logo" translate="no">
      {logo.archivo ? (
        // Logos pequeños (SVG de preferencia): no necesitan la optimización de next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.archivo}
          alt={oculto ? '' : logo.nombre}
          width={logo.ancho}
          height={logo.alto}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <span>{logo.nombre}</span>
      )}
    </li>
  );
}

export function FranjaLogos({
  logos = LOGOS_COMPATIBLES,
  className,
}: {
  logos?: readonly LogoCompatible[];
  className?: string;
}) {
  const copias = Array.from({ length: REPETICIONES * 2 }, (_, i) => i);
  return (
    <div className={cx('franja-logos', className)}>
      <div className="franja-pista">
        {copias.map((copia) => (
          <ul
            key={copia}
            aria-hidden={copia > 0 || undefined}
            aria-label={copia === 0 ? 'Plataformas y redes compatibles' : undefined}
            className="franja-grupo"
          >
            {logos.map((logo) => (
              <Logo key={logo.nombre} logo={logo} oculto={copia > 0} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
