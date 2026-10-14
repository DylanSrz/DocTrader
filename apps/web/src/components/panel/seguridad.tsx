import { cerrarOtrasSesiones, cerrarSesion } from '@/app/acciones-cuenta';
import { Enlace, Estado } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { type Sesion, tokenDeSesion } from '@/lib/sesion';
import { RegenerarCodigos } from './regenerar-codigos';

interface SesionAbierta {
  id: string;
  actual: boolean;
  navegador: string;
  ip: string;
  ultimaActividad: number;
}

const fecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

const botonEnlace =
  'inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco hover:decoration-current';

/** Seguridad de la cuenta: segundo factor y sesiones abiertas, que se pueden cerrar una por una. */
export async function Seguridad({ sesion }: { sesion: Sesion }) {
  const token = await tokenDeSesion();
  const respuesta = await llamarApi<SesionAbierta[]>('/auth/sesiones', { token });
  const sesiones = respuesta.ok ? respuesta.datos : [];

  return (
    <section aria-labelledby="t-seguridad" className="grid gap-10">
      <h2 id="t-seguridad" className="text-medio">
        Seguridad
      </h2>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-cuerpo font-normal">Segundo factor</h3>
          {sesion.usuario.segundoFactor ? (
            <Estado tono="senal">Activo</Estado>
          ) : (
            <Estado tono="neutro">Sin activar</Estado>
          )}
        </div>
        {sesion.usuario.segundoFactor ? (
          <RegenerarCodigos />
        ) : (
          <div className="grid max-w-[34em] gap-2">
            <p className="text-[15px] text-niebla">
              Recomendado: además de la contraseña, te pediremos un código de tu celular al
              ingresar.
            </p>
            <Enlace href="/segundo-factor">Activar el segundo factor</Enlace>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <h3 className="text-cuerpo font-normal">Sesiones abiertas</h3>
        <ul className="grid gap-1">
          {sesiones.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[15px]"
            >
              <div className="grid">
                <span className="text-blanco">
                  {s.navegador}
                  {s.actual ? <span className="text-senal"> · Esta sesión</span> : null}
                </span>
                <span className="text-sm text-ceniza">
                  <span className="cifra">{s.ip || 'IP desconocida'}</span> · Última actividad{' '}
                  {fecha.format(s.ultimaActividad)}
                </span>
              </div>
              {s.actual ? null : (
                <form action={cerrarSesion}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className={botonEnlace}>
                    Cerrar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {sesiones.length > 1 ? (
          <form action={cerrarOtrasSesiones}>
            <button type="submit" className={botonEnlace}>
              Cerrar todas las demás
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
