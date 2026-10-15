'use client';

import { LIMITES_ADJUNTO, tipoPorContenido } from '@doctrader/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { type PermisoSubida, pedirPermisoSubida } from '@/app/acciones-soporte';
import { tamanoArchivo } from '@/lib/soporte';

interface Archivo {
  clave: string;
  nombre: string;
  tamano: number;
  estado: 'subiendo' | 'listo' | 'error';
  progreso: number;
  id?: string;
  error?: string;
}

/** Un permiso vale 30 minutos; se pide otro un poco antes. */
const VIDA_PERMISO_MS = 25 * 60_000;

/** Sube un archivo directo a la API con su progreso. Resuelve con el id o con el mensaje de error. */
function subir(
  permiso: Extract<PermisoSubida, { ok: true }>,
  archivo: File,
  alAvanzar: (fraccion: number) => void,
  registrar: (xhr: XMLHttpRequest) => void,
): Promise<{ id: string } | { error: string }> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    registrar(xhr);
    xhr.open('POST', permiso.url);
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.setRequestHeader('x-doctrader-subida', permiso.ficha);
    xhr.setRequestHeader('x-doctrader-nombre', encodeURIComponent(archivo.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(e.loaded / e.total);
    };
    xhr.onload = () => {
      let cuerpo: { id?: string; mensaje?: string } = {};
      try {
        cuerpo = JSON.parse(xhr.responseText) as typeof cuerpo;
      } catch {
        // Respuesta que no es JSON: se usa el mensaje genérico.
      }
      if (xhr.status === 201 && cuerpo.id) resolver({ id: cuerpo.id });
      else resolver({ error: cuerpo.mensaje ?? 'No pudimos subir el archivo. Intenta de nuevo.' });
    };
    xhr.onerror = () =>
      resolver({ error: 'No pudimos subir el archivo. Revisa tu conexión e intenta de nuevo.' });
    xhr.onabort = () => resolver({ error: 'Cancelado.' });
    xhr.send(archivo);
  });
}

/**
 * Adjuntos de un mensaje de soporte: imágenes o PDF, hasta 5 de 10 MB. Se revisan en el navegador (tamaño y tipo
 * por el contenido, igual que la API) y se suben apenas se eligen, directo a la API. El formulario solo envía los
 * ids de los que terminaron (`name="adjuntos"`). Para limpiarlo, el formulario le cambia la `key`.
 */
export function Adjuntos({
  onSubiendo,
  etiqueta = 'Adjuntar capturas o PDF',
}: {
  /** Mientras algo sube, el formulario no se debe enviar. */
  onSubiendo?: (subiendo: boolean) => void;
  etiqueta?: string;
}) {
  const id = useId();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [aviso, setAviso] = useState('');
  const permiso = useRef<{ valor: Extract<PermisoSubida, { ok: true }>; desde: number } | null>(
    null,
  );
  const envios = useRef(new Map<string, XMLHttpRequest>());
  const subiendo = archivos.some((a) => a.estado === 'subiendo');

  useEffect(() => onSubiendo?.(subiendo), [subiendo, onSubiendo]);
  // Si el formulario se limpia (cambia la key) o se cierra el panel, se cancela lo que siga subiendo.
  useEffect(() => {
    const pendientes = envios.current;
    return () => pendientes.forEach((xhr) => xhr.abort());
  }, []);

  const cambiar = (clave: string, cambio: Partial<Archivo>) =>
    setArchivos((lista) => lista.map((a) => (a.clave === clave ? { ...a, ...cambio } : a)));

  async function obtenerPermiso() {
    if (permiso.current && Date.now() - permiso.current.desde < VIDA_PERMISO_MS) {
      return permiso.current.valor;
    }
    const nuevo = await pedirPermisoSubida();
    if (!nuevo.ok) return nuevo.error;
    permiso.current = { valor: nuevo, desde: Date.now() };
    return nuevo;
  }

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const usados = archivos.filter((a) => a.estado !== 'error').length;
    const libres = LIMITES_ADJUNTO.porMensaje - usados;
    const elegidos = Array.from(lista).slice(0, Math.max(0, libres));
    setAviso(
      lista.length > libres
        ? `Puedes adjuntar hasta ${LIMITES_ADJUNTO.porMensaje} archivos por mensaje.`
        : '',
    );
    const nuevos: { archivo: File; item: Archivo }[] = [];
    for (const archivo of elegidos) {
      const item: Archivo = {
        clave: `${archivo.name}-${archivo.size}-${Math.random().toString(36).slice(2)}`,
        nombre: archivo.name,
        tamano: archivo.size,
        estado: 'subiendo',
        progreso: 0,
      };
      if (archivo.size > LIMITES_ADJUNTO.maximoBytes) {
        item.estado = 'error';
        item.error = 'Pesa más de 10 MB.';
      } else if (!tipoPorContenido(new Uint8Array(await archivo.slice(0, 16).arrayBuffer()))) {
        item.estado = 'error';
        item.error = 'Solo imágenes (JPG, PNG o WEBP) o PDF.';
      }
      nuevos.push({ archivo, item });
    }
    setArchivos((actual) => [...actual, ...nuevos.map((n) => n.item)]);

    const porSubir = nuevos.filter((n) => n.item.estado === 'subiendo');
    if (porSubir.length === 0) return;
    const p = await obtenerPermiso();
    if (typeof p === 'string') {
      for (const n of porSubir) cambiar(n.item.clave, { estado: 'error', error: p });
      return;
    }
    await Promise.all(
      porSubir.map(async ({ archivo, item }) => {
        const resultado = await subir(
          p,
          archivo,
          (fraccion) => cambiar(item.clave, { progreso: fraccion }),
          (xhr) => envios.current.set(item.clave, xhr),
        );
        envios.current.delete(item.clave);
        if ('id' in resultado)
          cambiar(item.clave, { estado: 'listo', id: resultado.id, progreso: 1 });
        else cambiar(item.clave, { estado: 'error', error: resultado.error });
      }),
    );
  }

  function quitar(clave: string) {
    envios.current.get(clave)?.abort();
    envios.current.delete(clave);
    setArchivos((lista) => lista.filter((a) => a.clave !== clave));
    setAviso('');
  }

  const llenos = archivos.filter((a) => a.estado !== 'error').length >= LIMITES_ADJUNTO.porMensaje;

  return (
    <div className="grid w-full gap-2">
      <p id={`${id}-titulo`} className="text-[15px] text-blanco">
        {etiqueta} <span className="text-ceniza">(opcional, hasta 5 de 10&nbsp;MB)</span>
      </p>
      {/* El botón propio y no el del navegador: el nativo dice "Choose Files" según el idioma del sistema. */}
      <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-self-start rounded-pildora bg-campo px-[18px] text-sm font-medium text-blanco transition-[background-color,box-shadow] duration-200 hover:bg-campo-foco has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:shadow-[0_0_0_2px_var(--color-senal)]">
        {llenos
          ? 'Ya tienes 5 archivos'
          : archivos.length > 0
            ? 'Agregar más archivos'
            : 'Elegir archivos'}
        <input
          id={id}
          type="file"
          multiple
          accept={LIMITES_ADJUNTO.aceptar}
          disabled={llenos}
          aria-describedby={`${id}-titulo ${id}-aviso`}
          onChange={(e) => {
            const lista = e.currentTarget.files;
            void elegir(lista).finally(() => {
              e.target.value = '';
            });
          }}
          className="sr-only"
        />
      </label>
      <p id={`${id}-aviso`} aria-live="polite" className="text-sm text-error empty:hidden">
        {aviso}
      </p>
      {archivos.length > 0 ? (
        <ul aria-label="Archivos adjuntos" className="grid gap-2">
          {archivos.map((a) => (
            <li
              key={a.clave}
              className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] bg-campo px-4 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-blanco">{a.nombre}</span>
              <span
                className={
                  a.estado === 'error'
                    ? 'text-error'
                    : a.estado === 'listo'
                      ? 'text-senal'
                      : 'text-ceniza'
                }
              >
                {a.estado === 'error'
                  ? a.error
                  : a.estado === 'listo'
                    ? `Listo · ${tamanoArchivo(a.tamano)}`
                    : `Subiendo ${Math.round(a.progreso * 100)} %`}
              </span>
              <button
                type="button"
                onClick={() => quitar(a.clave)}
                className="inline-flex min-h-9 items-center text-ceniza underline decoration-white/35 underline-offset-4 hover:text-blanco"
              >
                Quitar<span className="sr-only"> {a.nombre}</span>
              </button>
              {a.id ? <input type="hidden" name="adjuntos" value={a.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
