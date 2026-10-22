import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 11, programa de referidos: publica los textos legales que lo cubren, como versiones nuevas.
 * - Términos: la sección "16. Programa de referidos", antes de "Soporte y comunicaciones"; las secciones 16 a 20 pasan
 *   a ser 17 a 21 (ninguna otra parte del texto cita esos números).
 * - Política de datos: los datos del programa (§4), su finalidad (§5) y lo que ve quien invitó al Titular (§8).
 * Si el texto vigente ya lo tiene, o un admin lo cambió y no están los puntos de anclaje, no publica nada (y lo dice en
 * el registro del despliegue): ese texto se ajusta a mano desde el panel con `docs/legal/`.
 * Las versiones viejas se conservan: las autorizaciones apuntan al texto que cada persona aceptó.
 */
const SECCION_TERMINOS = `## 16. Programa de referidos

16.1. **Quién participa.** Pueden recomendar la plataforma los clientes con una licencia activa (o en su periodo de
gracia) y las personas que DocTraderPRO habilite. Cada participante (el "Referidor") tiene un enlace y un código
personales en su panel.

16.2. **Comisión.** Cuando una persona se registra con el enlace o el código de un Referidor, cada licencia o renovación
que pague le deja al Referidor el porcentaje vigente publicado en la plataforma (hoy, el 20 % de lo pagado), mientras
siga siendo cliente. El porcentaje se fija al aprobar cada pago. Las compras aprobadas mientras la licencia del
Referidor esté vencida no generan comisión, salvo que DocTraderPRO lo haya habilitado.

16.3. **Pago.** Las comisiones se pagan en USDT por la red Tron (TRC20), a la dirección que el Referidor registre en su
panel, por quincenas (del 1 al 15 y del 16 al último día de cada mes, hora de Colombia), cuando lo acumulado llegue al
mínimo publicado (hoy, USD 20); si no llega, se suma a la quincena siguiente. Después de cambiar la dirección, el pago
siguiente espera 48 horas por seguridad. El Referidor responde por que su dirección sea correcta: un envío hecho a la
dirección que registró se considera pagado.

16.4. **No es una relación laboral.** Participar no crea una relación laboral, de agencia ni de sociedad. El Referidor
no representa a DocTraderPRO, no puede prometer rentabilidad ni presentar el Software como un servicio de inversión,
y no puede recomendarlo con correos o mensajes no solicitados ni con publicidad engañosa.

16.5. **Fraude.** No generan comisión las compras propias o de cuentas creadas para cobrarla (autorreferidos), los
registros con datos falsos ni los pagos con fondos de origen ilícito. DocTraderPRO puede anular las comisiones que
todavía no haya pagado y excluir del programa a quien incumpla estos términos.

16.6. **Impuestos.** Cada Referidor responde por las obligaciones tributarias de lo que recibe.

16.7. **Cambios.** DocTraderPRO puede cambiar el porcentaje o el mínimo, y pausar o terminar el programa. Los cambios
aplican a las ventas aprobadas después de publicarlos; lo ya ganado se paga según estas reglas.

16.8. **Quien recibe la invitación** paga el mismo precio que cualquier cliente y no recibe un beneficio por
registrarse con un enlace.

`;
const ANCLA_TERMINOS = '## 16. Soporte y comunicaciones';

const FILA_ANCLA =
  '| Soporte | Mensajes, archivos adjuntos y respuestas | Al abrir o responder un ticket |\n';
const FILA =
  '| Programa de referidos | Quién invitó a quién, la dirección de USDT (red Tron) donde se cobran las comisiones, las comisiones ganadas y los pagos enviados | Al registrarse con un enlace de invitación o al participar en el programa |\n';
const FINALIDAD_ANCLA =
  '10. Enviar novedades del servicio, solo si el Titular lo acepta por separado. Puede cancelarlas cuando quiera.\n';
const FINALIDAD =
  '11. Administrar el programa de referidos: saber quién invitó a cada cliente, calcular las comisiones y enviar los\n    pagos.\n';
const BALA_ANCLA = '- **Autoridades** que lo pidan';
const BALA = `- **Quien invitó al Titular**, si se registró con un enlace o código de invitación: esa persona ve solo su nombre de
  pila, la inicial de su apellido, si tiene una licencia activa y el valor de la comisión que le dejó cada compra.
  Nunca ve su correo, su documento, su teléfono ni sus cuentas de trading.
`;

/** Los términos con la sección nueva y las siguientes renumeradas, o `null` si no aplica. */
export function terminosConReferidos(texto: string): string | null {
  if (texto.includes('## 16. Programa de referidos') || !texto.includes(ANCLA_TERMINOS))
    return null;
  const corte = texto.indexOf(ANCLA_TERMINOS);
  let resto = texto.slice(corte);
  // De la última a la primera, para no renumerar dos veces.
  for (let n = 20; n >= 16; n--) {
    resto = resto
      .replace(new RegExp(`^## ${n}\\. `, 'gm'), `## ${n + 1}. `)
      .replace(new RegExp(`^${n}\\.(\\d+)\\. `, 'gm'), `${n + 1}.$1. `);
  }
  return texto.slice(0, corte) + SECCION_TERMINOS + resto;
}

/** La política de datos con los datos del programa, o `null` si no aplica. */
export function politicaConReferidos(texto: string): string | null {
  if (texto.includes('| Programa de referidos |')) return null;
  if (![FILA_ANCLA, FINALIDAD_ANCLA, BALA_ANCLA].every((a) => texto.includes(a))) return null;
  return texto
    .replace(FILA_ANCLA, FILA_ANCLA + FILA)
    .replace(FINALIDAD_ANCLA, FINALIDAD_ANCLA + FINALIDAD)
    .replace(BALA_ANCLA, BALA + BALA_ANCLA);
}

export class TerminosReferidos1793300000000 implements MigrationInterface {
  name = 'TerminosReferidos1793300000000';

  async up(q: QueryRunner): Promise<void> {
    for (const [tipo, cambiar] of [
      ['TERMS', terminosConReferidos],
      ['PRIVACY', politicaConReferidos],
    ] as const) {
      const [vigente] = (await q.query(
        `SELECT version, content_md FROM legal_documents WHERE type = $1 ORDER BY version DESC LIMIT 1`,
        [tipo],
      )) as { version: number; content_md: string }[];
      if (!vigente) continue;
      const nuevo = cambiar(vigente.content_md);
      if (!nuevo) {
        if (!vigente.content_md.includes('eferidos')) {
          console.warn(
            `${tipo}: no se encontraron los puntos de anclaje; publícalo a mano desde el panel.`,
          );
        }
        continue;
      }
      await q.query(`INSERT INTO legal_documents (type, version, content_md) VALUES ($1, $2, $3)`, [
        tipo,
        vigente.version + 1,
        nuevo,
      ]);
    }
  }

  async down(): Promise<void> {
    // Las versiones publicadas son historia: las autorizaciones de los clientes apuntan a ellas.
  }
}
