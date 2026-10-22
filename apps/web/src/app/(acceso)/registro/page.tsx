import type { Metadata } from 'next';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { FormularioRegistro } from './formulario';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  // Dirección oficial para los buscadores: "/registro?plan=…" cuenta como esta misma página.
  alternates: { canonical: '/registro' },
};

export default function Registro() {
  return (
    <PlantillaAcceso
      etiqueta="Crear cuenta"
      titulo="Empieza con tu cuenta."
      texto={
        <p>
          Con tu cuenta registras tus cuentas de trading y compras una licencia para cada una. Tu
          documento de identidad se guarda cifrado y solo lo ve el administrador.
        </p>
      }
    >
      <FormularioRegistro />
    </PlantillaAcceso>
  );
}
