import { Velas } from './velas';

/**
 * Gráfico de TradingView en vivo (oro contra dólar, velas de 15 minutos). Es el widget gratuito oficial dentro de un
 * iframe: la política de contenido de `/presentacion` permite solo ese origen (`next.config.ts`). En el PDF va el
 * dibujo de velas, porque el iframe no se imprime.
 */
const WIDGET = `https://s.tradingview.com/widgetembed/?${new URLSearchParams({
  symbol: 'OANDA:XAUUSD',
  interval: '15',
  theme: 'dark',
  style: '1',
  locale: 'es',
  timezone: 'America/Bogota',
  toolbarbg: '000000',
  hidesidetoolbar: '1',
  symboledit: '0',
  saveimage: '0',
  hideideas: '1',
  withdateranges: '0',
})}`;

export function GraficoEnVivo() {
  return (
    <div className="p-grafico">
      <iframe
        src={WIDGET}
        title="Gráfico en vivo del oro (XAU/USD) en TradingView"
        className="solo-pantalla h-full w-full"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      <Velas className="solo-impresion h-full w-full" />
    </div>
  );
}
