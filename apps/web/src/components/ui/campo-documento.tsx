'use client';

import { PAISES, tiposDocumento, validarDocumento } from '@doctrader/shared';
import { type ReactNode, useState } from 'react';
import { Campo } from './campo';
import { Selector } from './selector';

/**
 * País que expidió el documento, tipo y número. Los tipos dependen del país y el número se revisa con las mismas
 * reglas de la API (`validarDocumento`) desde que la persona sale del campo, sin esperar a enviar.
 */
export function CampoDocumento({
  valores = {},
  errores = {},
  ayuda,
}: {
  valores?: { documentoPais?: string; documentoTipo?: string; documento?: string };
  errores?: { documentoPais?: string; documentoTipo?: string; documento?: string };
  /** Debajo del país y el tipo: qué hacer si no aparecen. */
  ayuda?: ReactNode;
}) {
  const paisInicial = valores.documentoPais || 'CO';
  const [pais, setPais] = useState(paisInicial);
  const tipos = tiposDocumento(pais);
  // El tipo de entrada: el que volvió del servidor si es de este país; si no, el primero de la lista.
  const tipoDe = (p: string) =>
    p === paisInicial && tiposDocumento(p).some((t) => t.codigo === valores.documentoTipo)
      ? valores.documentoTipo!
      : (tiposDocumento(p)[0]?.codigo ?? '');
  const [tipo, setTipo] = useState(() => tipoDe(paisInicial));
  const [numero, setNumero] = useState(valores.documento ?? '');
  const [tocado, setTocado] = useState(false);
  const numerico = tipos.find((t) => t.codigo === tipo)?.numerico ?? false;
  const revision = validarDocumento(pais, tipo, numero);
  // Las reglas son las mismas de la API: una vez que la persona pasó por el campo, manda la revisión en vivo.
  const error = tocado
    ? numero && !revision.ok
      ? revision.mensaje
      : undefined
    : errores.documento;

  return (
    <fieldset className="grid gap-5">
      <legend className="mb-1 text-[15px] text-blanco">Documento de identidad</legend>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Selector
          etiqueta="País que lo expidió"
          name="documentoPais"
          // `defaultValue` (no `value`): cuando React reinicia el formulario tras enviarlo, una lista controlada
          // vuelve en pantalla a su primera opción aunque el estado diga otra. Con `defaultValue` vuelve a esta.
          defaultValue={paisInicial}
          autoComplete="country"
          onChange={(e) => {
            const nuevo = e.currentTarget.value;
            setPais(nuevo);
            setTipo(tipoDe(nuevo));
          }}
          error={errores.documentoPais}
        >
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        <Selector
          // Con otro país cambian las opciones: la lista se arma de nuevo con el tipo que corresponde.
          key={pais}
          etiqueta="Tipo de documento"
          name="documentoTipo"
          defaultValue={tipoDe(pais)}
          onChange={(e) => setTipo(e.currentTarget.value)}
          error={errores.documentoTipo}
        >
          {tipos.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nombre}
            </option>
          ))}
        </Selector>
      </div>
      {ayuda ? <p className="-mt-2 text-sm text-ceniza">{ayuda}</p> : null}
      <Campo
        etiqueta="Número del documento"
        name="documento"
        inputMode={numerico ? 'numeric' : 'text'}
        autoCapitalize={numerico ? 'off' : 'characters'}
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={30}
        value={numero}
        onChange={(e) => setNumero(e.currentTarget.value)}
        onBlur={() => setTocado(true)}
        ayuda={
          numerico
            ? 'Solo números, sin puntos, comas ni espacios. Solo una cuenta por persona.'
            : 'Letras y números, sin espacios ni guiones. Solo una cuenta por persona.'
        }
        error={error}
      />
    </fieldset>
  );
}
