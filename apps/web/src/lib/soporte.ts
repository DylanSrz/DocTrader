import {
  type EstadoOrden,
  type EstadoTicket,
  type PrioridadTicket,
  type TemaTicket,
  type TipoAdjunto,
  ZONA_HORARIA,
} from '@doctrader/shared';

/** Respuestas de la API de soporte (`apps/api/src/soporte`). Las fechas llegan como texto ISO. */

export interface Adjunto {
  id: string;
  nombre: string;
  tipo: TipoAdjunto;
  tamano: number;
}

export interface MisTickets {
  tickets: {
    id: string;
    numero: number;
    asunto: string;
    tema: TemaTicket;
    estado: EstadoTicket;
    cuenta: string | null;
    orden: string | null;
    ultimoMensaje: string;
    creadoEn: string;
  }[];
  cuentas: { id: string; numero: string; broker: string }[];
  ordenes: { id: string; numero: string; estado: EstadoOrden; plan: string; cuenta: string }[];
  adjuntos: boolean;
  diasCierre: number;
}

interface Cabecera {
  id: string;
  numero: number;
  asunto: string;
  tema: TemaTicket;
  estado: EstadoTicket;
  creadoEn: string;
  resueltoEn: string | null;
  cerradoEn: string | null;
  cierraEn: string | null;
  cuenta: { id: string; numero: string; broker: string } | null;
  orden: { numero: string; estado: EstadoOrden } | null;
  adjuntos: boolean;
}

export interface MensajeVista {
  id: string;
  deEquipo: boolean;
  autor: string;
  texto: string;
  creadoEn: string;
  adjuntos: Adjunto[];
  interna?: boolean;
}

export interface TicketCliente extends Cabecera {
  mensajes: MensajeVista[];
}

export interface RespuestaGuardada {
  id: string;
  titulo: string;
  cuerpo: string;
}

export interface TicketAdmin extends Cabecera {
  prioridad: PrioridadTicket;
  asignadoA: string | null;
  primeraRespuesta: string | null;
  esperaDesde: string;
  cliente: { id: string; nombre: string; correo: string };
  admins: { id: string; nombre: string }[];
  respuestas: RespuestaGuardada[];
  mensajes: (MensajeVista & { interna: boolean })[];
}

export type VistaBandeja = 'sin' | 'abiertos' | 'resueltos' | 'todos';

export interface Bandeja {
  tickets: {
    id: string;
    numero: number;
    asunto: string;
    tema: TemaTicket;
    estado: EstadoTicket;
    prioridad: PrioridadTicket;
    cliente: string;
    asignado: string | null;
    cuenta: string | null;
    esperaDesde: string;
    ultimoMensaje: string;
  }[];
  conteos: Record<VistaBandeja, number>;
  primeraRespuestaMinutos: number | null;
  masAntiguo: string | null;
  siguiente: number | null;
  admins: { id: string; nombre: string }[];
}

type Tono = 'senal' | 'llama' | 'neutro' | 'apagado' | 'error';

/** El estado como lo lee el cliente: "Te respondimos" pide su atención. */
export const ESTADO_TICKET_CLIENTE: Record<EstadoTicket, { texto: string; tono: Tono }> = {
  ABIERTO: { texto: 'Abierto', tono: 'neutro' },
  RESPONDIDO: { texto: 'Te respondimos', tono: 'llama' },
  RESUELTO: { texto: 'Resuelto', tono: 'senal' },
  CERRADO: { texto: 'Cerrado', tono: 'apagado' },
};

/** El estado como lo lee el admin: "Sin responder" es lo que espera. */
export const ESTADO_TICKET_ADMIN: Record<EstadoTicket, { texto: string; tono: Tono }> = {
  ABIERTO: { texto: 'Sin responder', tono: 'llama' },
  RESPONDIDO: { texto: 'Respondido', tono: 'neutro' },
  RESUELTO: { texto: 'Resuelto', tono: 'senal' },
  CERRADO: { texto: 'Cerrado', tono: 'apagado' },
};

export const NOMBRE_VISTA: Record<VistaBandeja, string> = {
  sin: 'Sin responder',
  abiertos: 'Abiertos',
  resueltos: 'Resueltos',
  todos: 'Todos',
};

/** "840 KB", "3,2 MB". */
export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
}

/** "40 min", "16 h", "3 días": cuánto pasó desde una fecha. */
export function tiempoDesde(fecha: string | Date, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 60_000));
  if (minutos < 60) return `${Math.max(1, minutos)} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} días`;
}

/** "3 h 20 min", "45 min": un promedio de minutos. */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${Math.max(1, minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const hora = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONA_HORARIA,
});
const dia = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: ZONA_HORARIA,
});
const diaAnio = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});
const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA });

/** "Hoy, 09:40", "Ayer, 18:12", "2 sep, 18:12" o "2 sep 2025", en hora de Colombia. */
export function cuando(fecha: string | Date, conHora = true, ahora = new Date()): string {
  const f = new Date(fecha);
  const sinPunto = (t: string) => t.replace('.', '').replaceAll(' de ', ' ');
  const hoy = claveDia.format(ahora);
  const ayer = claveDia.format(new Date(ahora.getTime() - 86_400_000));
  const clave = claveDia.format(f);
  const h = hora.format(f);
  if (clave === hoy) return conHora ? `Hoy, ${h}` : 'Hoy';
  if (clave === ayer) return conHora ? `Ayer, ${h}` : 'Ayer';
  if (clave.slice(0, 4) !== hoy.slice(0, 4)) return sinPunto(diaAnio.format(f));
  return conHora ? `${sinPunto(dia.format(f))}, ${h}` : sinPunto(dia.format(f));
}
