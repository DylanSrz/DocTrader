/** Estado de un formulario con acción del servidor: errores por campo, un mensaje general y lo ya escrito. */
export interface EstadoFormulario {
  /** Cambia en cada envío, para volver a montar el desafío de Turnstile (cada token sirve una vez). */
  envio?: number;
  mensaje?: string;
  /** El mensaje es un éxito (verde) y no un error. */
  exito?: boolean;
  campos?: Record<string, string>;
  /** Lo que la persona escribió (nunca contraseñas), para no borrarlo si hay un error. */
  valores?: Record<string, string>;
  /** Pedir el desafío de Turnstile en el próximo envío. */
  desafio?: boolean;
}

export function texto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === 'string' ? valor : '';
}
