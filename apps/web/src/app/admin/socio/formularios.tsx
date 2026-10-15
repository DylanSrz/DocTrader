'use client';

import { useActionState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion } from '@/components/admin/operacion';
import { BotonEnviar, Campo } from '@/components/ui';
import {
  cambiarPorcentaje,
  type EstadoOperacion,
  marcarComisionPagada,
} from '../acciones-operacion';

const cambiarPorcentajeConAviso = conAviso(cambiarPorcentaje);
const marcarPagadaConAviso = conAviso(marcarComisionPagada);

/** Solo lo ve el socio: su porcentaje aplica a las ventas que se aprueben después del cambio. */
export function EditarPorcentaje({ porcentaje }: { porcentaje: string }) {
  const [estado, accion] = useActionState(cambiarPorcentajeConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid w-full max-w-[420px] gap-4">
      <Campo
        etiqueta="Nuevo porcentaje (%)"
        name="porcentaje"
        inputMode="decimal"
        defaultValue={estado.valores?.porcentaje ?? porcentaje}
        ayuda="Aplica solo a las ventas que se aprueben después del cambio. Al otro administrador le llega un aviso y el cambio queda en la auditoría."
        error={estado.campos?.porcentaje}
      />
      <CampoCodigo estado={estado} accion="cambiar tu porcentaje" />
      <div>
        <BotonEnviar enviando="Guardando…">Guardar porcentaje</BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/** Registrar el pago de una quincena cerrada, con la referencia (hash, comprobante) si la hay. */
export function MarcarPagada({ id, periodo }: { id: string; periodo: string }) {
  const [estado, accion] = useActionState(marcarPagadaConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid max-w-[420px] gap-4">
      <input type="hidden" name="liquidacion" value={id} />
      <input type="hidden" name="periodo" value={periodo} />
      <Campo
        etiqueta="Referencia del pago (opcional)"
        name="referencia"
        maxLength={200}
        defaultValue={estado.valores?.referencia}
        ayuda="El hash de la transferencia o el número del comprobante."
        error={estado.campos?.referencia}
      />
      <CampoCodigo estado={estado} accion="marcarla como pagada" />
      <div>
        <BotonEnviar variante="enlace" enviando="Guardando…">
          Marcar como pagada
        </BotonEnviar>
      </div>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}
