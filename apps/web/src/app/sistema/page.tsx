import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatearUsd } from '@doctrader/shared';
import { Campo, Enlace, Estado, Etiqueta, Pildora, Triangulo } from '@/components/ui';
import { Marca } from '@/components/marca';

export const metadata: Metadata = {
  title: 'Sistema de diseño',
  robots: { index: false, follow: false },
};

const COLORES = [
  ['vacio', '#000000', 'Fondo de todo'],
  ['blanco', '#FFFFFF', 'Titulares y texto principal'],
  ['niebla', '#BDBDBD', 'Texto secundario'],
  ['ceniza', '#9A9A9A', 'Notas y menú'],
  ['llama', '#FB9819', 'Único color de acción'],
  ['senal', '#DDDB65', 'Chispa: etiquetas y foco'],
  ['brasa', '#E2531F', 'Solo en las partículas del logo'],
  ['error', '#FF7A59', 'Errores'],
] as const;

/** Referencia viva del sistema de la propuesta 2. Solo existe en desarrollo y en el entorno de pruebas. */
export default function Sistema() {
  if (process.env.NODE_ENV === 'production' && process.env.MOSTRAR_SISTEMA !== 'true') notFound();

  return (
    <main className="contenedor grid gap-24 py-16">
      <header className="grid gap-6">
        <Marca />
        <Etiqueta>Sistema de diseño · propuesta 2</Etiqueta>
        <h1 className="text-grande">Negro puro, una sola acción, el triángulo como unidad.</h1>
      </header>

      <section className="grid gap-8" aria-labelledby="t-colores">
        <h2 id="t-colores" className="text-medio">
          Colores
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-8">
          {COLORES.map(([nombre, hex, uso]) => (
            <li key={nombre} className="grid gap-3">
              <span
                className="h-16 rounded-pildora shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                style={{ background: hex }}
              />
              <span className="text-sm">
                {nombre} <span className="text-ceniza cifra">{hex}</span>
              </span>
              <span className="text-sm text-ceniza">{uso}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6" aria-labelledby="t-tipo">
        <h2 id="t-tipo" className="text-medio">
          Tipografía
        </h2>
        <p className="text-display">Display 113</p>
        <p className="text-grande">Grande 78</p>
        <p className="text-medio">Medio 36</p>
        <p className="max-w-[34em] text-niebla">
          Texto corrido en Inter 300 a 18 px, en gris niebla. Los titulares van en 400 con
          interletrado de −0.04em.
        </p>
        <p className="texto-menu text-ceniza">Menú y botones: 14 px, 600, mayúsculas</p>
        <p className="text-medio cifra">
          {formatearUsd(380_200)} · {formatearUsd(38_020)}
        </p>
      </section>

      <section className="grid gap-6" aria-labelledby="t-acciones">
        <h2 id="t-acciones" className="text-medio">
          Acciones
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <Pildora>Comprar licencia</Pildora>
          <Enlace href="#t-acciones">Ver cómo funciona</Enlace>
          <Enlace href="#t-acciones" gris>
            Enlace gris
          </Enlace>
          <Pildora disabled>Desactivada</Pildora>
        </div>
      </section>

      <section className="grid gap-6" aria-labelledby="t-estados">
        <h2 id="t-estados" className="text-medio">
          Estados
        </h2>
        <div className="flex flex-wrap gap-3">
          <Estado tono="senal">Conectada</Estado>
          <Estado tono="llama">Vence pronto</Estado>
          <Estado tono="neutro">Por conectar</Estado>
          <Estado tono="apagado">Expirada</Estado>
          <Estado tono="error">Monto incompleto</Estado>
        </div>
        <div
          className="flex items-center gap-1.5 text-llama"
          aria-label="Calendario de ejemplo: 3 días usados de 7"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <Triangulo
              key={i}
              tamano={14}
              relleno={i === 2}
              className={i < 2 ? 'text-white/25' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="grid max-w-md gap-6" aria-labelledby="t-campos">
        <h2 id="t-campos" className="text-medio">
          Campos
        </h2>
        <Campo etiqueta="Correo" type="email" placeholder="tu@correo.com" autoComplete="email" />
        <Campo etiqueta="Cédula" inputMode="numeric" ayuda="Solo números, sin puntos." />
        <Campo
          etiqueta="Teléfono"
          type="tel"
          defaultValue="300 123"
          error="Escribe el número completo."
        />
      </section>
    </main>
  );
}
