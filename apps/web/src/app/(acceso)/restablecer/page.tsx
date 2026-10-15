import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioRestablecer } from './formulario';

export const metadata: Metadata = { title: 'Nueva contraseña', referrer: 'no-referrer' };

export default function Restablecer() {
  return (
    <PlantillaAcceso
      etiqueta="Nueva contraseña"
      titulo="Escribe tu contraseña nueva."
      texto="Al menos 10 caracteres. Una frase corta que solo tú conozcas es más segura que una palabra con símbolos."
    >
      <FormularioRestablecer />
    </PlantillaAcceso>
  );
}
