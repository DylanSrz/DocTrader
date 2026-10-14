import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioRecuperar } from './formulario';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function Recuperar() {
  return (
    <PlantillaAcceso
      etiqueta="Recuperar contraseña"
      titulo="Crea una contraseña nueva."
      texto="Escribe el correo de tu cuenta y te enviamos un enlace. Por seguridad, al cambiarla se cierran todas tus sesiones."
    >
      <FormularioRecuperar />
    </PlantillaAcceso>
  );
}
