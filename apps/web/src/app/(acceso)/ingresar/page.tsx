import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioIngreso } from './formulario';

export const metadata: Metadata = { title: 'Ingresar' };

export default function Ingresar() {
  return (
    <PlantillaAcceso
      etiqueta="Tu panel"
      titulo="Ingresa a tu cuenta."
      texto="Desde tu panel compras y renuevas licencias, ves tus pagos y hablas con soporte."
    >
      <FormularioIngreso />
    </PlantillaAcceso>
  );
}
