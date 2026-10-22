import type { ReactNode } from 'react';
import { AvisoBreve } from '@/components/panel/aviso-breve';
import { Cabecera } from '@/components/panel/cabecera';
import { PieLegal } from '@/components/pie-legal';

export default function LayoutPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera
        pestanas={[
          { href: '/panel', texto: 'Mis cuentas' },
          { href: '/panel/pagos', texto: 'Pagos' },
          {
            href: '/panel/soporte',
            texto: 'Soporte',
            aviso: { tipo: 'punto', uno: '1 respuesta nueva', varios: '# respuestas nuevas' },
          },
          { href: '/panel/referidos', texto: 'Referidos' },
          { href: '/panel/perfil', texto: 'Perfil' },
        ]}
      />
      <main id="contenido" className="contenedor flex-1 pt-[clamp(56px,8vw,120px)] pb-[120px]">
        {children}
      </main>
      <PieLegal />
      <AvisoBreve />
    </div>
  );
}
