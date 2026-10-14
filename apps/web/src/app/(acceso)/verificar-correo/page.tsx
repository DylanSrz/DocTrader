import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioVerificar } from './formulario';

export const metadata: Metadata = { title: 'Confirmar correo', referrer: 'no-referrer' };

export default function VerificarCorreo() {
  return (
    <PlantillaAcceso
      etiqueta="Confirmar correo"
      titulo="Un paso más."
      texto="Confirma tu correo para activar tu cuenta. Después ya puedes ingresar a tu panel."
    >
      <FormularioVerificar />
    </PlantillaAcceso>
  );
}
