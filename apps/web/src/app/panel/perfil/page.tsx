import { formatearTelefono } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Seguridad } from '@/components/panel/seguridad';
import { Enlace } from '@/components/ui';
import { fechaLarga } from '@/lib/formato';
import { leerPanel, type Perfil } from '@/lib/panel';
import { obtenerLanding } from '@/lib/publico';
import { requerirSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Perfil' };

async function Contenido() {
  const sesion = await requerirSesion('CLIENT');
  const [perfil, landing] = await Promise.all([
    leerPanel<Perfil>('/auth/perfil'),
    obtenerLanding(),
  ]);
  const telefono = perfil.telefono ? formatearTelefono(perfil.telefono) : '—';
  const datos = [
    {
      dt: 'Cédula',
      dd: perfil.cedulaUltimos4 ? `•••• ${perfil.cedulaUltimos4}` : '—',
      cifra: true,
    },
    { dt: 'Correo', dd: perfil.correo },
    { dt: 'Celular', dd: telefono, cifra: true },
  ];
  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <h1 className="text-grande">{perfil.nombre}</h1>
        <p className="text-blanco">Cliente desde el {fechaLarga(perfil.clienteDesde)}.</p>
      </div>
      <dl className="mt-[clamp(64px,8vw,104px)] grid max-w-[980px] grid-cols-2 gap-x-[clamp(32px,6vw,96px)] gap-y-10 max-sm:grid-cols-1">
        {datos.map((d) => (
          <div key={d.dt} className="grid gap-1.5">
            <dt className="text-sm text-ceniza">{d.dt}</dt>
            <dd
              className={`text-[clamp(22px,2.2vw,27px)] font-normal tracking-[-0.02em] break-words ${
                d.cifra ? 'cifra' : ''
              }`}
            >
              {d.dd}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-14 grid max-w-[980px] gap-7">
        <p className="max-w-[40em] text-niebla">
          Tu cédula se guarda cifrada y solo la ve el administrador. Para cambiar tu nombre, cédula,
          correo o celular, abre un ticket en Soporte o escríbenos a {landing.correoSoporte}.
        </p>
        <div className="flex flex-wrap items-center gap-x-6">
          <Enlace href="/panel/soporte?nuevo=1&tema=OTRO">Abrir un ticket</Enlace>
          <Enlace href="/recuperar" gris>
            Cambiar mi contraseña
          </Enlace>
        </div>
      </div>
      <div className="mt-[clamp(96px,12vw,168px)]">
        <Seguridad sesion={sesion} />
      </div>
      <section
        aria-labelledby="t-eliminar"
        className="mt-[clamp(96px,12vw,168px)] grid max-w-[980px] justify-items-start gap-5"
      >
        <h2 id="t-eliminar" className="text-medio">
          Eliminar mi cuenta
        </h2>
        <p className="max-w-[40em] text-niebla">
          Si quieres que borremos tu cuenta y tus datos, pídelo en un ticket. Borramos tus datos
          personales, las contraseñas de tus cuentas de trading y tus tickets; tus licencias
          terminan sin devolución. Por ley conservamos solo el registro de tus pagos.
        </p>
        <Enlace href="/panel/soporte?nuevo=1&tema=OTRO" gris>
          Pedir que eliminen mi cuenta
        </Enlace>
      </section>
    </>
  );
}

export default function PerfilPagina() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tu perfil…</p>}>
      <Contenido />
    </Suspense>
  );
}
