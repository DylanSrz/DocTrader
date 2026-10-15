import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioRegistro } from './formulario';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function Registro() {
  return (
    <PlantillaAcceso
      etiqueta="Crear cuenta"
      titulo="Empieza con tu cuenta."
      texto={
        <p>
          Con tu cuenta registras tus cuentas de trading y compras una licencia para cada una. Tu
          cédula se guarda cifrada y solo la ve el administrador.
        </p>
      }
    >
      <FormularioRegistro />
    </PlantillaAcceso>
  );
}
