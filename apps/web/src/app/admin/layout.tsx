import type { ReactNode } from 'react';
import { AvisoBreve } from '@/components/panel/aviso-breve';
import { Cabecera } from '@/components/panel/cabecera';
import { PieLegal } from '@/components/pie-legal';

export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera
        pestanas={[
          { href: '/admin', texto: 'Hoy' },
          { href: '/admin/pagos', texto: 'Pagos' },
          { href: '/admin/cuentas', texto: 'Cuentas' },
          {
            href: '/admin/soporte',
            texto: 'Soporte',
            tambien: ['/admin/respuestas'],
            aviso: {
              tipo: 'numero',
              uno: '1 ticket sin responder',
              varios: '# tickets sin responder',
            },
          },
          { href: '/admin/clientes', texto: 'Clientes' },
          { href: '/admin/licencias', texto: 'Licencias' },
          {
            href: '/admin/ajustes',
            texto: 'Ajustes',
            tambien: ['/admin/preguntas', '/admin/legal'],
          },
          { href: '/admin/referidos', texto: 'Referidos' },
          { href: '/admin/socio', texto: 'Socio' },
        ]}
      />
      <main id="contenido" className="contenedor flex-1 py-16 lg:py-24">
        {children}
      </main>
      <PieLegal />
      <AvisoBreve />
    </div>
  );
}
