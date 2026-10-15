/**
 * Correos de cuentas y acceso. Texto plano y HTML sencillo con la marca: fondo claro (muchos lectores de correo
 * cambian los fondos oscuros), un solo botón naranja y el aviso antiphishing en el pie.
 */

export const PLANTILLA = {
  VERIFICAR_CORREO: 'verificar-correo',
  YA_REGISTRADO: 'ya-registrado',
  RESTABLECER_CONTRASENA: 'restablecer-contrasena',
  CONTRASENA_CAMBIADA: 'contrasena-cambiada',
  NUEVO_INGRESO: 'nuevo-ingreso',
  INTENTOS_FALLIDOS: 'intentos-fallidos',
  SEGUNDO_FACTOR_ACTIVADO: 'segundo-factor-activado',
  CODIGO_RECUPERACION_USADO: 'codigo-recuperacion-usado',
  CUENTA_TRADING_CAMBIADA: 'cuenta-trading-cambiada',
  PRECIO_BTC_DIFERENTE: 'precio-btc-diferente',
} as const;
export type Plantilla = (typeof PLANTILLA)[keyof typeof PLANTILLA];

export interface CorreoListo {
  asunto: string;
  texto: string;
  html: string;
}

interface Contenido {
  asunto: string;
  saludo: string;
  parrafos: string[];
  boton?: { texto: string; url: string };
  despues?: string[];
}

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PIE =
  'DocTraderPRO nunca te pedirá tu contraseña ni tus códigos por correo, chat o teléfono. ' +
  'Si tienes dudas, responde este correo o escríbenos a support@doctraderpro.com.';

function armar({ asunto, saludo, parrafos, boton, despues = [] }: Contenido): CorreoListo {
  const texto = [
    saludo,
    '',
    ...parrafos.flatMap((p) => [p, '']),
    ...(boton ? [`${boton.texto}: ${boton.url}`, ''] : []),
    ...despues.flatMap((p) => [p, '']),
    '—',
    PIE,
    'DocTraderPRO · Barranquilla, Colombia',
  ].join('\n');

  const p = (contenido: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1a1a1a">${escapar(contenido)}</p>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px 32px 8px;font-family:Inter,Helvetica,Arial,sans-serif">
<p style="margin:0 0 24px;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#000">DocTrader<span style="color:#fb9819">PRO</span></p>
${p(saludo)}
${parrafos.map(p).join('\n')}
${
  boton
    ? `<p style="margin:8px 0 24px"><a href="${escapar(boton.url)}" style="display:inline-block;padding:14px 22px;border-radius:24px;background:#fb9819;color:#000;font-size:15px;font-weight:500;text-decoration:none">${escapar(boton.texto)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b6b6b">Si el botón no funciona, copia este enlace en el navegador:<br><span style="word-break:break-all">${escapar(boton.url)}</span></p>`
    : ''
}
${despues.map(p).join('\n')}
</td></tr>
<tr><td style="padding:16px 32px 32px;font-family:Inter,Helvetica,Arial,sans-serif;border-top:1px solid #eee">
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6b6b">${escapar(PIE)}</p>
<p style="margin:0;font-size:13px;color:#6b6b6b">DocTraderPRO · Barranquilla, Colombia</p>
</td></tr></table></td></tr></table></body></html>`;

  return { asunto, texto, html };
}

/** Arma el correo de una plantilla. `secreto` es el enlace de un solo uso, si la plantilla lo lleva. */
export function renderizar(
  plantilla: string,
  datos: Record<string, string>,
  secreto: string | null,
  web: string,
): CorreoListo {
  const saludo = `Hola, ${datos.nombre ?? ''}:`.replace(', :', ':');
  switch (plantilla) {
    case PLANTILLA.VERIFICAR_CORREO:
      return armar({
        asunto: 'Confirma tu correo en DocTraderPRO',
        saludo,
        parrafos: ['Gracias por registrarte. Confirma tu correo para poder ingresar a tu panel.'],
        boton: { texto: 'Confirmar mi correo', url: `${web}/verificar-correo#token=${secreto}` },
        despues: ['El enlace vale 24 horas. Si no creaste esta cuenta, ignora este correo.'],
      });
    case PLANTILLA.YA_REGISTRADO:
      return armar({
        asunto: 'Ya tienes una cuenta en DocTraderPRO',
        saludo,
        parrafos: [
          'Alguien intentó crear una cuenta nueva con este correo, pero ya tienes una.',
          'Si fuiste tú, ingresa con tu contraseña o, si no la recuerdas, crea una nueva.',
        ],
        boton: { texto: 'Recuperar mi contraseña', url: `${web}/recuperar` },
        despues: ['Si no fuiste tú, no tienes que hacer nada: tu cuenta sigue igual.'],
      });
    case PLANTILLA.RESTABLECER_CONTRASENA:
      return armar({
        asunto: 'Crea tu nueva contraseña de DocTraderPRO',
        saludo,
        parrafos: ['Recibimos una solicitud para crear una nueva contraseña para tu cuenta.'],
        boton: { texto: 'Crear nueva contraseña', url: `${web}/restablecer#token=${secreto}` },
        despues: [
          'El enlace vale 30 minutos y sirve una sola vez. Al cambiar la contraseña se cierran todas tus sesiones.',
          'Si no lo pediste, ignora este correo: tu contraseña sigue igual.',
        ],
      });
    case PLANTILLA.CONTRASENA_CAMBIADA:
      return armar({
        asunto: 'Tu contraseña de DocTraderPRO cambió',
        saludo,
        parrafos: [
          `Tu contraseña se cambió el ${datos.fecha}. Cerramos todas tus sesiones por seguridad.`,
          'Si no fuiste tú, escríbenos de inmediato a support@doctraderpro.com.',
        ],
      });
    case PLANTILLA.NUEVO_INGRESO:
      return armar({
        asunto: 'Nuevo ingreso a tu cuenta de DocTraderPRO',
        saludo,
        parrafos: [
          'Alguien ingresó a tu cuenta desde un navegador que no habíamos visto antes:',
          `Fecha: ${datos.fecha} · Navegador: ${datos.navegador} · IP: ${datos.ip}`,
          'Si fuiste tú, no tienes que hacer nada. Si no, cambia tu contraseña y cierra las demás sesiones desde tu panel.',
        ],
        boton: { texto: 'Cambiar mi contraseña', url: `${web}/recuperar` },
      });
    case PLANTILLA.INTENTOS_FALLIDOS:
      return armar({
        asunto: 'Intentos de ingreso fallidos en tu cuenta',
        saludo,
        parrafos: [
          'Hubo varios intentos de ingresar a tu cuenta con una contraseña equivocada. Por seguridad, ahora pedimos un desafío extra y una espera entre intentos.',
          'Si no fuiste tú, te recomendamos crear una contraseña nueva y activar el segundo factor.',
        ],
        boton: { texto: 'Crear nueva contraseña', url: `${web}/recuperar` },
      });
    case PLANTILLA.SEGUNDO_FACTOR_ACTIVADO:
      return armar({
        asunto: 'Activaste el segundo factor en DocTraderPRO',
        saludo,
        parrafos: [
          `El ${datos.fecha} se activó el segundo factor de tu cuenta con una app de autenticación. Desde ahora, al ingresar te pediremos el código de 6 dígitos.`,
          'Guarda tus códigos de recuperación en un lugar seguro. Si no fuiste tú, escríbenos de inmediato.',
        ],
      });
    case PLANTILLA.CODIGO_RECUPERACION_USADO:
      return armar({
        asunto: 'Se usó un código de recuperación de tu cuenta',
        saludo,
        parrafos: [
          `El ${datos.fecha} se ingresó a tu cuenta con un código de recuperación. Te quedan ${datos.restantes}.`,
          'Si no fuiste tú, cambia tu contraseña y escríbenos de inmediato.',
        ],
      });
    case PLANTILLA.CUENTA_TRADING_CAMBIADA:
      return armar({
        asunto: `Cambiaron los datos de tu cuenta de trading ${datos.numero}`,
        saludo,
        parrafos: [
          `El ${datos.fecha} se cambiaron los datos de la cuenta de trading ${datos.numero} en tu panel (${datos.campos}).`,
          datos.reconectar === 'si'
            ? 'Como la cuenta ya estaba conectada, la actualizaremos en el copy trading. Te avisaremos cuando quede lista.'
            : 'Si no fuiste tú, cambia tu contraseña de DocTraderPRO y escríbenos de inmediato.',
        ],
        boton: { texto: 'Ver mis cuentas', url: `${web}/panel` },
      });
    case PLANTILLA.PRECIO_BTC_DIFERENTE:
      return armar({
        asunto: 'No se pudo fijar el precio de BTC',
        saludo,
        parrafos: [
          `Los proveedores del precio de BTC no coinciden: Binance dice USD ${datos.binance} y CoinGecko USD ${datos.coingecko} (más de 1 % de diferencia).`,
          'Mientras no coincidan, los clientes no pueden crear órdenes en BTC; las de USDT siguen funcionando. Si se repite, revisa los proveedores.',
        ],
      });
    default:
      throw new Error(`Plantilla desconocida: ${plantilla}`);
  }
}
