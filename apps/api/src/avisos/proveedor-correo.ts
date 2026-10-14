import type { CorreoListo } from './plantillas.js';

export interface Remitente {
  de: string;
  responderA: string;
}

export interface ProveedorCorreo {
  nombre: string;
  /** Envía el correo y devuelve el id que le dio el proveedor. `id` sirve para no enviarlo dos veces. */
  enviar(id: string, para: string, correo: CorreoListo, remitente: Remitente): Promise<string>;
}

/** Resend, en producción. La llave de idempotencia evita duplicados si el worker reintenta. */
export function resend(llave: string): ProveedorCorreo {
  return {
    nombre: 'resend',
    async enviar(id, para, correo, remitente) {
      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${llave}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': id,
        },
        body: JSON.stringify({
          from: remitente.de,
          to: [para],
          reply_to: remitente.responderA,
          subject: correo.asunto,
          html: correo.html,
          text: correo.texto,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!respuesta.ok) throw new Error(`Resend ${respuesta.status}: ${cuerpo.message ?? ''}`);
      return cuerpo.id ?? '';
    },
  };
}

/** Mailpit, en desarrollo: los correos se ven en localhost:8025 y no salen a internet. */
export function mailpit(url: string): ProveedorCorreo {
  return {
    nombre: 'mailpit',
    async enviar(_id, para, correo, remitente) {
      const coincide = /^(.*)<(.+)>$/.exec(remitente.de);
      const respuesta = await fetch(new URL('/api/v1/send', url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: coincide
            ? { Name: coincide[1]!.trim(), Email: coincide[2]!.trim() }
            : { Email: remitente.de },
          To: [{ Email: para }],
          ReplyTo: [{ Email: remitente.responderA }],
          Subject: correo.asunto,
          HTML: correo.html,
          Text: correo.texto,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok) throw new Error(`Mailpit ${respuesta.status}`);
      const cuerpo = (await respuesta.json()) as { ID?: string };
      return cuerpo.ID ?? '';
    },
  };
}

/** Sin proveedor, en desarrollo: el correo se escribe en la consola. Nunca se usa en producción. */
export function consola(escribir: (mensaje: string) => void): ProveedorCorreo {
  return {
    nombre: 'consola',
    async enviar(id, para, correo) {
      escribir(`Correo para ${para} — ${correo.asunto}\n${correo.texto}`);
      return `consola-${id}`;
    },
  };
}
