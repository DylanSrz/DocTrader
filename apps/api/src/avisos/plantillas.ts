/**
 * Correos de la plataforma. Texto plano y HTML sencillo con la marca: fondo claro (muchos lectores de correo
 * cambian los fondos oscuros), un solo botón naranja y el aviso antiphishing en el pie.
 */

import { CORREO_SOPORTE } from '@doctrader/shared';

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
  PAGO_APROBADO: 'pago-aprobado',
  PAGO_RECHAZADO: 'pago-rechazado',
  CUENTA_CONECTADA: 'cuenta-conectada',
  LICENCIA_EXTENDIDA: 'licencia-extendida',
  DIRECCION_DEPOSITO: 'direccion-deposito',
  TICKET_NUEVO: 'ticket-nuevo',
  TICKET_REABIERTO: 'ticket-reabierto',
  TICKET_RESPONDIDO: 'ticket-respondido',
  TICKET_RESUELTO: 'ticket-resuelto',
  BIENVENIDA: 'bienvenida',
  LICENCIA_POR_VENCER: 'licencia-por-vencer',
  LICENCIA_EN_GRACIA: 'licencia-en-gracia',
  LICENCIA_VENCIDA: 'licencia-vencida',
  PAGO_POR_REVISAR: 'pago-por-revisar',
  VENTA_APROBADA: 'venta-aprobada',
  CUENTA_POR_CONECTAR: 'cuenta-por-conectar',
  CUENTA_POR_DESCONECTAR: 'cuenta-por-desconectar',
  COMISION_CAMBIADA: 'comision-cambiada',
  COMISION_LIQUIDADA: 'comision-liquidada',
  CUENTA_ELIMINADA: 'cuenta-eliminada',
  PAGO_ATASCADO: 'pago-atascado',
  TRABAJO_FALLIDO: 'trabajo-fallido',
  INGRESOS_FALLIDOS: 'ingresos-fallidos',
  AUDITORIA_ALTERADA: 'auditoria-alterada',
  REFERIDO_COMISION: 'referido-comision',
  REFERIDO_PAGO_ENVIADO: 'referido-pago-enviado',
  REFERIDO_DIRECCION_CAMBIADA: 'referido-direccion-cambiada',
  REFERIDOS_POR_PAGAR: 'referidos-por-pagar',
  REGISTRO_NUEVO: 'registro-nuevo',
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

/** Texto escapado con el correo de soporte como enlace `mailto:` (en el HTML del correo). */
function conEnlaceDeSoporte(texto: string): string {
  return escapar(texto).replaceAll(
    CORREO_SOPORTE,
    `<a href="mailto:${CORREO_SOPORTE}" style="color:inherit">${CORREO_SOPORTE}</a>`,
  );
}

/**
 * El icono de la marca (cerebro sobre fondo negro, se ve igual en modo claro y oscuro). Va con la dirección pública
 * de producción: un correo de desarrollo tampoco podría cargarlo desde localhost. Si se mueve el archivo de
 * `apps/web/public/marca`, hay que cambiarlo aquí.
 */
const LOGO = 'https://www.doctraderpro.com/marca/icono-192.png';

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
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1a1a1a">${conEnlaceDeSoporte(contenido)}</p>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px 32px 8px;font-family:Inter,Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
<td style="padding:0 12px 0 0;vertical-align:middle"><img src="${LOGO}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;border-radius:10px"></td>
<td style="vertical-align:middle;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#000">DocTrader<span style="color:#fb9819">PRO</span></td>
</tr></table>
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
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6b6b">${conEnlaceDeSoporte(PIE)}</p>
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
    case PLANTILLA.PAGO_APROBADO:
      return armar({
        asunto: `Pago aprobado: tu licencia ${datos.plan} está activa`,
        saludo,
        parrafos: [
          `Aprobamos el pago de la orden ${datos.orden}. La licencia ${datos.plan} de la cuenta de trading ${datos.cuenta} está activa hasta el ${datos.vence}.`,
          datos.conectar === 'si'
            ? 'Ahora conectamos la cuenta al copy trading. Te avisaremos por correo cuando quede conectada.'
            : 'La cuenta sigue conectada al copy trading; no tienes que hacer nada.',
        ],
        boton: { texto: 'Ver mis cuentas', url: `${web}/panel` },
      });
    case PLANTILLA.PAGO_RECHAZADO:
      return armar({
        asunto: `No pudimos aprobar el pago de la orden ${datos.orden}`,
        saludo,
        parrafos: [
          `Revisamos el pago de la orden ${datos.orden} y no lo pudimos aprobar. Motivo: ${datos.motivo}`,
          'Si crees que es un error o quieres saber cómo seguir, responde este correo o escríbenos por Telegram.',
        ],
        boton: { texto: 'Ver mis pagos', url: `${web}/panel/pagos` },
      });
    case PLANTILLA.CUENTA_CONECTADA:
      return armar({
        asunto: `Tu cuenta ${datos.cuenta} está conectada`,
        saludo,
        parrafos: [
          datos.actualizada === 'si'
            ? `Actualizamos la cuenta de trading ${datos.cuenta} (${datos.broker}) en el copy trading con los datos nuevos. Ya está conectada otra vez.`
            : `Conectamos la cuenta de trading ${datos.cuenta} (${datos.broker}) al copy trading. Desde ahora, la operativa se replica en ella.`,
          'Mantén en la cuenta el capital recomendado que ves en tu panel. Si cambias la contraseña de la cuenta en el broker, actualízala también en tu panel para que no se desconecte.',
        ],
        boton: { texto: 'Ver mis cuentas', url: `${web}/panel` },
      });
    case PLANTILLA.LICENCIA_EXTENDIDA:
      return armar({
        asunto: `Sumamos ${datos.dias} a tu licencia`,
        saludo,
        parrafos: [
          `Sumamos ${datos.dias} a la licencia de la cuenta de trading ${datos.cuenta}, sin costo. Ahora vence el ${datos.vence}.`,
        ],
        boton: { texto: 'Ver mis cuentas', url: `${web}/panel` },
      });
    case PLANTILLA.DIRECCION_DEPOSITO:
      return armar({
        asunto: `Dirección de depósito ${datos.accion}: ${datos.red}`,
        saludo,
        parrafos: [
          `${datos.quien} ${datos.verbo} una dirección de depósito de ${datos.red} el ${datos.fecha}:`,
          datos.direccion ?? '',
          ...(datos.activa
            ? [
                `Los clientes la verán en sus órdenes desde el ${datos.activa}. Si no reconoces este cambio, cancélala antes desde Ajustes y cambia la contraseña del panel.`,
              ]
            : []),
        ],
        boton: { texto: 'Ver las direcciones', url: `${web}/admin/ajustes#direcciones` },
        despues: ['Este aviso les llega a los dos administradores.'],
      });
    case PLANTILLA.TICKET_NUEVO:
    case PLANTILLA.TICKET_REABIERTO: {
      const nuevo = plantilla === PLANTILLA.TICKET_NUEVO;
      return armar({
        asunto: `${nuevo ? 'Ticket nuevo' : 'Ticket reabierto'} ${datos.numero}: ${datos.asunto}`,
        saludo,
        parrafos: [
          nuevo
            ? `${datos.cliente} abrió el ticket ${datos.numero} (${datos.tema}): "${datos.asunto}".`
            : `${datos.cliente} volvió a abrir el ticket ${datos.numero} (${datos.tema}): "${datos.asunto}". Dice que el problema sigue.`,
          'Respóndelo desde Soporte en el panel: al cliente le llega tu respuesta por correo.',
        ],
        boton: { texto: 'Ver el ticket', url: `${web}/admin/soporte?ticket=${datos.numero}` },
      });
    }
    case PLANTILLA.TICKET_RESPONDIDO:
      return armar({
        asunto: `Te respondimos: ${datos.asunto} (ticket ${datos.numero})`,
        saludo,
        parrafos: [
          `Respondimos tu ticket ${datos.numero}, "${datos.asunto}":`,
          ...(datos.mensaje ?? '').split(/\n{2,}/).filter((p) => p.trim()),
        ],
        boton: { texto: 'Ver y responder', url: `${web}/panel/soporte?ticket=${datos.numero}` },
        despues: [
          'Para que tu respuesta quede en el ticket, escríbela desde tu panel. Si ya se resolvió, puedes marcarlo como resuelto allí mismo.',
        ],
      });
    case PLANTILLA.TICKET_RESUELTO:
      return armar({
        asunto: `Resolvimos tu ticket ${datos.numero}`,
        saludo,
        parrafos: [
          `Marcamos como resuelto tu ticket ${datos.numero}, "${datos.asunto}".`,
          `Si el problema sigue, escríbenos en el mismo ticket desde tu panel antes del ${datos.cierre} y lo abrimos de nuevo. Después de esa fecha se cierra solo.`,
        ],
        boton: { texto: 'Ver el ticket', url: `${web}/panel/soporte?ticket=${datos.numero}` },
      });
    case PLANTILLA.BIENVENIDA:
      return armar({
        asunto: 'Bienvenido a DocTraderPRO',
        saludo,
        parrafos: [
          'Tu correo quedó confirmado. Así empiezas:',
          '1. Agrega tu cuenta de trading en el panel (broker, servidor, número y contraseñas).',
          '2. Elige tu licencia y paga en USDT (Tron) o BTC. Revisamos el pago en la blockchain.',
          '3. Conectamos tu cuenta al copy trading y te avisamos por correo.',
          'Una licencia sirve para una cuenta de trading. Antes de que venza te recordamos renovarla.',
        ],
        boton: { texto: 'Ir a mi panel', url: `${web}/panel` },
      });
    case PLANTILLA.LICENCIA_POR_VENCER: {
      const cuando = datos.dias === '1' ? 'mañana' : `en ${datos.dias} días`;
      return armar({
        asunto: `Tu licencia de la cuenta ${datos.cuenta} vence ${cuando}`,
        saludo,
        parrafos: [
          `La licencia ${datos.plan} de la cuenta de trading ${datos.cuenta} vence el ${datos.vence}.`,
          'Renuévala antes para que la cuenta siga conectada sin cortes: los días nuevos se suman al vencimiento actual, así que no pierdes ninguno.',
        ],
        boton: { texto: 'Renovar mi licencia', url: `${web}/panel` },
      });
    }
    case PLANTILLA.LICENCIA_EN_GRACIA:
      return armar({
        asunto: `Tu licencia de la cuenta ${datos.cuenta} venció`,
        saludo,
        parrafos: [
          `La licencia de la cuenta de trading ${datos.cuenta} venció hoy. Por ahora la cuenta sigue conectada: tienes hasta el ${datos.gracia} para renovarla.`,
          'Si no se renueva antes de esa fecha, desconectaremos la cuenta del copy trading. Al renovar, el periodo nuevo cuenta desde el vencimiento.',
        ],
        boton: { texto: 'Renovar mi licencia', url: `${web}/panel` },
      });
    case PLANTILLA.LICENCIA_VENCIDA:
      return armar({
        asunto: `Desconectaremos la cuenta ${datos.cuenta}`,
        saludo,
        parrafos: [
          `Terminaron los días de gracia de la licencia de la cuenta de trading ${datos.cuenta} sin que se renovara. ${
            datos.conectada === 'si'
              ? 'Vamos a desconectarla del copy trading.'
              : 'La cuenta queda sin licencia.'
          }`,
          'Si quieres volver, compra una licencia nueva desde tu panel y la conectamos otra vez.',
        ],
        boton: { texto: 'Ir a mi panel', url: `${web}/panel` },
      });
    case PLANTILLA.PAGO_POR_REVISAR: {
      const verificado = datos.estado === 'VERIFICADA';
      return armar({
        asunto: verificado
          ? `Pago verificado por aprobar: orden ${datos.orden}`
          : `Pago por revisar a mano: orden ${datos.orden}`,
        saludo,
        parrafos: [
          verificado
            ? `El pago de la orden ${datos.orden} (${datos.cliente}, licencia ${datos.plan}, ${datos.monto}) pasó la verificación en la blockchain. Falta que lo apruebes.`
            : datos.estado === 'POR_CONFIRMAR'
              ? `El pago de la orden ${datos.orden} (${datos.cliente}, licencia ${datos.plan}, ${datos.monto}) coincide en la blockchain, pero ${datos.motivo.charAt(0).toLowerCase()}${datos.motivo.slice(1)}.`
              : `El pago de la orden ${datos.orden} (${datos.cliente}, licencia ${datos.plan}, ${datos.monto}) no pasó la verificación: ${datos.motivo}.`,
          verificado
            ? 'Al aprobarlo, la licencia se activa y al cliente le llega el correo.'
            : 'Revísalo en el explorador antes de aprobarlo o rechazarlo.',
        ],
        boton: { texto: 'Ver el pago', url: `${web}/admin/pagos` },
      });
    }
    case PLANTILLA.VENTA_APROBADA:
      return armar({
        asunto: `Venta: licencia ${datos.plan} por ${datos.monto}`,
        saludo,
        parrafos: [
          `${datos.quien} el pago de la orden ${datos.orden}: licencia ${datos.plan} de ${datos.cliente} para la cuenta ${datos.cuenta}, por ${datos.monto}.`,
          datos.conectar === 'si'
            ? 'La cuenta quedó por conectar en Social Trader Tools.'
            : 'La cuenta ya estaba conectada: no hay que hacer nada.',
        ],
        boton:
          datos.conectar === 'si'
            ? { texto: 'Ver las cuentas por conectar', url: `${web}/admin/cuentas` }
            : { texto: 'Ver los pagos', url: `${web}/admin/pagos` },
      });
    case PLANTILLA.REGISTRO_NUEVO:
      return armar({
        asunto: `Nuevo registro: ${datos.cliente}`,
        saludo,
        parrafos: [
          `${datos.cliente} se registró en DocTraderPRO y confirmó su correo${datos.invitadoPor ? `. Lo invitó ${datos.invitadoPor}` : ''}.`,
          `Correo: ${datos.correo}. Teléfono: ${datos.telefono}.`,
          'Todavía no agrega una cuenta de trading. Su ficha muestra cómo avanza.',
        ],
        boton: { texto: 'Ver su ficha', url: `${web}/admin/clientes?ficha=${datos.id}` },
      });
    case PLANTILLA.CUENTA_POR_CONECTAR:
      return armar({
        asunto: `Cuenta por actualizar: ${datos.cuenta}`,
        saludo,
        parrafos: [
          `${datos.cliente} cambió los datos de la cuenta de trading ${datos.cuenta} (${datos.campos}). Como estaba conectada, quedó por conectar otra vez.`,
          'Actualízala en Social Trader Tools y márcala como conectada: al cliente le llega el correo.',
        ],
        boton: { texto: 'Ver las cuentas por conectar', url: `${web}/admin/cuentas` },
      });
    case PLANTILLA.CUENTA_POR_DESCONECTAR:
      return armar({
        asunto: `Cuenta por desconectar: ${datos.cuenta}`,
        saludo,
        parrafos: [
          `La licencia de la cuenta de trading ${datos.cuenta} (${datos.cliente}, ${datos.broker}) terminó su gracia sin renovarse.`,
          'Desconéctala en Social Trader Tools y márcala como desconectada.',
        ],
        boton: { texto: 'Ver las cuentas por desconectar', url: `${web}/admin/cuentas` },
      });
    case PLANTILLA.COMISION_CAMBIADA:
      return armar({
        asunto: `La comisión del socio cambió a ${datos.nuevo}`,
        saludo,
        parrafos: [
          `${datos.quien} cambió la comisión del socio de ${datos.anterior} a ${datos.nuevo} el ${datos.fecha}.`,
          'Aplica a las ventas que se aprueben desde ahora; las anteriores conservan el porcentaje con el que se aprobaron.',
        ],
        boton: { texto: 'Ver el perfil del socio', url: `${web}/admin/socio` },
        despues: ['Este aviso les llega a los dos administradores.'],
      });
    case PLANTILLA.COMISION_LIQUIDADA:
      return armar({
        asunto: `Comisión del ${datos.periodo}: ${datos.comision}`,
        saludo,
        parrafos: [
          `Se cerró el periodo del ${datos.periodo}: ventas por ${datos.bruto} en ${datos.ventas}, comisión de ${datos.comision}.`,
          datos.pagar === 'no'
            ? 'No hay nada que pagar en este periodo.'
            : 'Cuando se pague, márquenlo como pagado en el perfil del socio con la referencia del pago.',
        ],
        boton: { texto: 'Ver el perfil del socio', url: `${web}/admin/socio` },
      });
    case PLANTILLA.CUENTA_ELIMINADA:
      return armar({
        asunto: 'Eliminamos tu cuenta de DocTraderPRO',
        saludo,
        parrafos: [
          'Como lo pediste, eliminamos tu cuenta de DocTraderPRO: tus datos personales, las contraseñas de tus cuentas de trading y tus tickets de soporte.',
          'Conservamos solo el registro de tus pagos (órdenes, montos y fechas), porque la ley nos exige guardarlo. Tus licencias terminaron y, si alguna cuenta estaba conectada, la desconectamos del copy trading en las próximas horas.',
          'Si quieres volver, puedes registrarte de nuevo cuando quieras.',
        ],
      });
    case PLANTILLA.PAGO_ATASCADO:
      return armar({
        asunto: `Pago sin verificar hace más de una hora: orden ${datos.orden}`,
        saludo,
        parrafos: [
          `El pago de la orden ${datos.orden} (${datos.cliente}, ${datos.monto}) se reportó hace más de una hora y todavía no se pudo verificar en la blockchain. Estado: ${datos.estado}.`,
          'Puede ser un proveedor caído o un pago con pocas confirmaciones. Revísalo en el explorador y, si está bien, apruébalo a mano.',
        ],
        boton: { texto: 'Ver el pago', url: `${web}/admin/pagos` },
      });
    case PLANTILLA.TRABAJO_FALLIDO:
      return armar({
        asunto: `Falló un trabajo del worker: ${datos.trabajo}`,
        saludo,
        parrafos: [
          `El trabajo "${datos.trabajo}" del worker falló el ${datos.fecha}: ${datos.error}`,
          'Se vuelve a intentar solo en su próxima vuelta. Si este aviso se repite, revisa los registros del worker en Railway (y Sentry, si está activo). Este aviso llega como máximo una vez al día por trabajo.',
        ],
      });
    case PLANTILLA.INGRESOS_FALLIDOS:
      return armar({
        asunto: `${datos.total} ingresos fallidos en una hora`,
        saludo,
        parrafos: [
          `Entre las ${datos.desde} y las ${datos.hasta} hubo ${datos.total} intentos de ingreso con una contraseña equivocada. Puede ser alguien probando contraseñas.`,
          'La plataforma ya frena los intentos por IP y por cuenta, y pide el desafío anti-bots. Si se repite, revisa los registros en Railway y, si hace falta, activa el modo de ataque de Cloudflare.',
        ],
      });
    case PLANTILLA.AUDITORIA_ALTERADA:
      return armar({
        asunto: 'La auditoría no cuadra: revisa la base de datos',
        saludo,
        parrafos: [
          `La revisión diaria encontró que el registro de auditoría número ${datos.fila} no coincide con su huella. Puede ser que alguien con acceso a la base de datos lo haya cambiado o borrado.`,
          'Sigue el plan de incidentes de docs/SEGURIDAD.md §14: revisa quién tiene acceso a la base de datos, cambia las llaves y contraseñas y compara con la última copia de seguridad.',
        ],
      });
    case PLANTILLA.REFERIDO_COMISION:
      return armar({
        asunto: `Ganaste ${datos.comision} por un referido`,
        saludo,
        parrafos: [
          datos.via
            ? `${datos.referido}, de la red de ${datos.via} (tu segunda línea), pagó su licencia ${datos.plan}. Tu comisión es de ${datos.comision} (${datos.porcentaje} de ${datos.monto}).`
            : `${datos.referido}, a quien invitaste, pagó su licencia ${datos.plan}. Tu comisión es de ${datos.comision} (${datos.porcentaje} de ${datos.monto}).`,
          datos.direccion === 'si'
            ? 'Te la enviamos en USDT (red Tron) con el pago de la quincena, cuando lo que tienes por cobrar llegue al mínimo.'
            : 'Para recibirla, registra en tu panel la dirección de USDT (red Tron) donde quieres cobrar.',
        ],
        boton: { texto: 'Ver mis referidos', url: `${web}${datos.ruta ?? '/panel/referidos'}` },
      });
    case PLANTILLA.REFERIDO_PAGO_ENVIADO:
      return armar({
        asunto: `Te enviamos ${datos.monto} por tus referidos`,
        saludo,
        parrafos: [
          `Enviamos ${datos.monto} en USDT (red Tron) a tu dirección ${datos.direccion}, por las comisiones del ${datos.periodo}.`,
          `Comprobante de la transacción: ${datos.hash}`,
        ],
        boton: { texto: 'Ver mis referidos', url: `${web}${datos.ruta ?? '/panel/referidos'}` },
      });
    case PLANTILLA.REFERIDO_DIRECCION_CAMBIADA:
      return armar({
        asunto:
          datos.horas === '0'
            ? 'Registraste tu dirección de cobro'
            : 'Cambiaste tu dirección de cobro',
        saludo,
        parrafos: [
          `La dirección donde recibes las comisiones de referidos ahora es ${datos.direccion}.`,
          datos.horas === '0'
            ? 'Si no hiciste este cambio, cambia tu contraseña y escríbenos de inmediato a support@doctraderpro.com.'
            : `Por seguridad, el próximo pago queda en espera ${datos.horas} horas. Si no hiciste este cambio, cambia tu contraseña y escríbenos de inmediato a support@doctraderpro.com.`,
        ],
        boton: { texto: 'Ver mis referidos', url: `${web}${datos.ruta ?? '/panel/referidos'}` },
      });
    case PLANTILLA.REFERIDOS_POR_PAGAR:
      return armar({
        asunto: `Pagos de referidos por enviar: ${datos.total}`,
        saludo,
        parrafos: [
          `Se cerraron ${datos.pagos} de referidos por ${datos.total} en total.`,
          'Envíen cada monto en USDT (red Tron) a la dirección que muestra el panel y márquenlo como enviado con el hash de la transacción.',
        ],
        boton: { texto: 'Ver los referidos', url: `${web}/admin/referidos` },
        despues: ['Este aviso les llega a los dos administradores.'],
      });
    default:
      throw new Error(`Plantilla desconocida: ${plantilla}`);
  }
}
