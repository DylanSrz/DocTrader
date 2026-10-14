import { Etiqueta, Enlace } from '@/components/ui';
import { Marca } from '@/components/marca';

/**
 * Página temporal mientras se construye la plataforma (la landing completa llega en la etapa 2).
 * Mismo sistema de la propuesta 2: negro, Inter, una sola acción.
 */
export default function Inicio() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="contenedor pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <Marca />
      </header>

      <main className="contenedor flex flex-1 flex-col justify-center gap-8 py-20">
        <Etiqueta>Licencia de software de copy trading</Etiqueta>
        <h1 className="max-w-[12ch] text-display">Tu cuenta, conectada al sistema de Argemiro.</h1>
        <p className="max-w-[34em] text-niebla">
          Estamos preparando la plataforma para comprar y gestionar tu licencia de{' '}
          <span translate="no">Doc Trader Pro AI</span>. Mientras tanto, escríbenos por Telegram o
          al correo de soporte.
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Enlace href="https://t.me/+cdmWH_xLubdhMDhh" target="_blank" rel="noopener">
            Grupo de Telegram
          </Enlace>
          {/* El correo va como texto seleccionable: los enlaces mailto no siempre abren algo. */}
          <span className="text-sm text-ceniza select-all" translate="no">
            support@doctraderpro.com
          </span>
        </div>
      </main>

      <footer className="contenedor pb-10 text-sm text-ceniza">
        <p className="max-w-[60em]">
          Operar en los mercados financieros tiene un riesgo alto y puedes perder todo tu capital.
          Los resultados pasados no garantizan resultados futuros. DocTraderPRO vende una licencia
          de uso de software; no es asesoría de inversión ni administra tu dinero.
        </p>
      </footer>
    </div>
  );
}
