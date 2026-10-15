/**
 * Preguntas frecuentes de la landing. Argemiro las edita desde el panel; estas son las del lanzamiento (las del
 * prototipo de la propuesta 2). Las respuestas son Markdown sencillo: párrafos, **negrita** y [enlaces](url).
 */
export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export const PREGUNTAS_INICIALES: readonly PreguntaFrecuente[] = [
  {
    pregunta: '¿Qué estoy comprando?',
    respuesta:
      'Una licencia de uso del software DocTraderPRO para una cuenta de trading. No es asesoría de inversión ni administración de tu dinero: el software replica en tu cuenta las operaciones del sistema.',
  },
  {
    pregunta: '¿Mi dinero sale de mi cuenta?',
    respuesta:
      'No. Tu dinero se queda en tu broker. Los depósitos y los retiros los haces tú, directamente con él.',
  },
  {
    pregunta: '¿Qué broker puedo usar?',
    respuesta:
      'El que prefieras, siempre que sea compatible con el copiado. Si no tienes uno, yo uso [JustMarkets](https://one.justmarkets.link/a/5vmbn05zda). Es un enlace de referido.',
  },
  {
    pregunta: '¿Cuánto capital necesito?',
    respuesta:
      'Argemiro te recomienda un capital y un nivel de riesgo para cada cuenta. Los ves en tu panel después de agregarla.',
  },
  {
    pregunta: '¿Cómo pago?',
    respuesta:
      'Con USDT (red Tron) o Bitcoin. Al comprar recibes una orden con la dirección y el monto exacto, válida por 1 hora. Cuando reportas el código de la transacción, lo verificamos en la blockchain.',
  },
  {
    pregunta: '¿Qué pasa cuando vence mi licencia?',
    respuesta:
      'Te avisamos antes. Si no renuevas, tienes 3 días de gracia con la cuenta conectada; después se desconecta del copiado.',
  },
  {
    pregunta: '¿Cómo pido ayuda?',
    respuesta:
      'Desde tu panel abres un ticket de soporte: queda registrado y te avisamos por correo cuando respondemos. Para dudas rápidas, escríbenos por [Telegram](https://t.me/+cdmWH_xLubdhMDhh) o a support@doctraderpro.com.',
  },
  {
    pregunta: '¿Hay devoluciones?',
    respuesta:
      'No. Por eso existe la prueba: 15 días por USD 50. Si sigues, pagas solo la diferencia del plan que elijas.',
  },
];

/** Límites de las preguntas frecuentes (los valida la API al guardarlas). */
export const LIMITES_PREGUNTAS = { maximo: 30, pregunta: 200, respuesta: 2_000 } as const;

/** Enlaces de la marca. Se editan desde el panel (ajuste `links`); estos son los del lanzamiento. */
export const ENLACES_INICIALES = {
  telegram: 'https://t.me/+cdmWH_xLubdhMDhh',
  instagram: 'https://www.instagram.com/doctraderproiasystem/',
  broker: { name: 'JustMarkets', url: 'https://one.justmarkets.link/a/5vmbn05zda' },
};

/**
 * Cuenta de Argemiro en Myfxbook y las cifras que muestra la landing (ajuste `myfxbook`). Solo la ganancia
 * mientras el historial esté incompleto (ver docs/PENDIENTES.md).
 */
export const MYFXBOOK_INICIAL = {
  url: 'https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459',
  accountId: '12253459',
  figures: {
    gainPercent: '246.68' as string | null,
    maxDrawdownPercent: null as string | null,
    auditedSince: null as string | null,
    asOf: '2026-10-14' as string | null,
  },
};

export const CORREO_SOPORTE = 'support@doctraderpro.com';
