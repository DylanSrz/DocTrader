'use client';

import { useActionState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion } from '@/components/admin/operacion';
import { BotonEnviar, Campo, Casilla } from '@/components/ui';
import { Selector } from '@/components/ui/selector';
import {
  anularComisionReferido,
  cambiarAjustesReferidos,
  type EstadoOperacion,
  habilitarReferidorPorCorreo,
  marcarReferidoEnviado,
} from '../acciones-operacion';

const enviadoConAviso = conAviso(marcarReferidoEnviado);
const ajustesConAviso = conAviso(cambiarAjustesReferidos);
const anularConAviso = conAviso(anularComisionReferido);
const habilitarConAviso = conAviso(habilitarReferidorPorCorreo);

/** Marcar enviado un pago de referidos: el hash de la transacción en Tron (o el número de la transferencia). */
export function MarcarEnviado({ id, referidor }: { id: string; referidor: string }) {
  const [estado, accion] = useActionState(enviadoConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid max-w-[520px] gap-4">
      <input type="hidden" name="pago" value={id} />
      <input type="hidden" name="referidor" value={referidor} />
      <Campo
        etiqueta="Hash de la transacción"
        name="hash"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={200}
        required
        defaultValue={estado.valores?.hash}
        ayuda="Lo da Binance al enviar (ID de la transacción). Si fue una transferencia interna, su número."
        error={estado.campos?.hash}
      />
      <CampoCodigo estado={estado} accion="marcarlo como enviado" />
      <div>
        <BotonEnviar variante="enlace" enviando="Guardando…">
          Marcar como enviado
        </BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

export function AjustesReferidos({
  porcentaje,
  segundaLinea,
  minimo,
  activo,
}: {
  porcentaje: string;
  segundaLinea: string;
  minimo: string;
  activo: boolean;
}) {
  const [estado, accion] = useActionState(ajustesConAviso, {} as EstadoOperacion);
  const v = estado.valores;
  return (
    <form action={accion} noValidate className="grid w-full max-w-[420px] gap-5">
      <Campo
        etiqueta="Comisión por la primera línea (%)"
        name="porcentaje"
        inputMode="decimal"
        defaultValue={v?.porcentaje ?? porcentaje}
        ayuda="Sobre lo que paga quien se registró con el enlace. Aplica a las ventas que se aprueben después del cambio."
        error={estado.campos?.porcentaje || undefined}
      />
      <Campo
        etiqueta="Comisión por la segunda línea (%)"
        name="segundaLinea"
        inputMode="decimal"
        defaultValue={v?.segundaLinea ?? segundaLinea}
        ayuda="Sobre lo que pagan los referidos de los referidos. Con 0 no hay comisión de segunda línea."
        error={estado.campos?.segundaLinea || undefined}
      />
      <Campo
        etiqueta="Mínimo para enviar un pago (USD)"
        name="minimo"
        inputMode="decimal"
        defaultValue={v?.minimo ?? minimo}
        ayuda="Lo que no llega se suma a la quincena siguiente."
        error={estado.campos?.minimo || undefined}
      />
      <Casilla name="activo" value="si" defaultChecked={v ? v.activo === 'si' : activo}>
        Programa activo: los enlaces suman referidos nuevos y las compras dejan comisión.
      </Casilla>
      <CampoCodigo estado={estado} accion="cambiar el programa" />
      <div>
        <BotonEnviar enviando="Guardando…">Guardar ajustes</BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/** Quitar la comisión de una venta sin liquidar (autorreferido, fraude, error). */
export function AnularComision() {
  const [estado, accion] = useActionState(anularConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid w-full max-w-[420px] gap-4">
      <Campo
        etiqueta="Número de la orden"
        name="numero"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={40}
        defaultValue={estado.valores?.numero}
        error={estado.campos?.numero}
      />
      <Selector etiqueta="Qué comisión" name="nivel" defaultValue={estado.valores?.nivel ?? ''}>
        <option value="">Las dos líneas</option>
        <option value="1">Solo la de primera línea</option>
        <option value="2">Solo la de segunda línea</option>
      </Selector>
      <Campo
        etiqueta="Motivo"
        name="motivo"
        maxLength={500}
        defaultValue={estado.valores?.motivo}
        ayuda="Queda en la auditoría. Solo se anula una comisión que todavía no entró en un pago."
        error={estado.campos?.motivo}
      />
      <CampoCodigo estado={estado} accion="anular la comisión" />
      <div>
        <BotonEnviar variante="enlace" enviando="Anulando…">
          Anular comisión
        </BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/** Habilitar para referir a alguien registrado que no ha comprado (sin cuenta de trading no tiene ficha en Licencias). */
export function HabilitarPorCorreo() {
  const [estado, accion] = useActionState(habilitarConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid w-full max-w-[420px] gap-4">
      <Campo
        etiqueta="Correo con el que se registró"
        name="correo"
        type="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        defaultValue={estado.valores?.correo}
        error={estado.campos?.correo}
      />
      <Selector
        etiqueta="Qué hacer"
        name="habilitado"
        defaultValue={estado.valores?.habilitado ?? 'si'}
      >
        <option value="si">Habilitar para referir</option>
        <option value="no">Quitar la habilitación</option>
      </Selector>
      <CampoCodigo estado={estado} accion="cambiar la habilitación" />
      <div>
        <BotonEnviar variante="enlace" enviando="Guardando…">
          Guardar
        </BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}
