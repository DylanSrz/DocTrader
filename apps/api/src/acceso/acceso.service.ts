import {
  correoCanonico,
  ESTADO_SESION,
  ESTADO_USUARIO,
  claveDocumento,
  problemaContrasena,
  validarDocumento,
  normalizarTelefono,
  ROL,
  TIPO_CONSENTIMIENTO,
  TIPO_DOCUMENTO_LEGAL,
} from '@doctrader/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import QRCode from 'qrcode';
import { type DataSource, type EntityManager, IsNull, MoreThan } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvisosService, primerNombre } from '../avisos/avisos.service.js';
import { ContenidoService } from '../contenido/contenido.service.js';
import { fechaLegible } from '../avisos/fecha.js';
import { PLANTILLA } from '../avisos/plantillas.js';
import {
  AuthToken,
  Consent,
  PROPOSITO_ENLACE,
  type PropositoEnlace,
  RecoveryCode,
  User,
} from '../database/entidades/index.js';
import { claveIngresosFallidos } from '../monitoreo/alertas.js';
import { REDIS } from '../redis/redis.module.js';
import { referidorParaRegistro } from '../referidos/reglas.js';
import { secretoAleatorio } from '../seguridad/cifrado.js';
import { CifradoService } from '../seguridad/cifrado.service.js';
import { ContrasenasService } from '../seguridad/contrasenas.service.js';
import { errorApi, errorDeCampos } from '../seguridad/errores.js';
import { demasiadosIntentos, LIMITES, LimitesService } from '../seguridad/limites.service.js';
import { TurnstileService } from '../seguridad/turnstile.service.js';
import {
  type ContextoCliente,
  DURACION_CONFIRMACION,
  MAXIMO_INTENTOS_CODIGO,
  type SesionActiva,
  SesionesService,
} from '../sesiones/sesiones.service.js';
import type { ConfirmarDto, CorreoDto, IngresoDto, RegistroDto, RestablecerDto } from './dto.js';
import {
  enlaceTotp,
  normalizarCodigoRecuperacion,
  nuevoSecretoTotp,
  nuevosCodigosRecuperacion,
  periodoDelCodigo,
} from './segundo-factor.js';

/** Contextos del cifrado y de las huellas: cada dato con el suyo. */
export const CONTEXTO = {
  cedula: 'users.cedula',
  totp: 'users.totp',
  totpPendiente: 'totp.pendiente',
} as const;

const VIGENCIA_ENLACE: Record<PropositoEnlace, number> = {
  [PROPOSITO_ENLACE.VERIFICAR_CORREO]: 24 * 60 * 60_000,
  [PROPOSITO_ENLACE.RESTABLECER_CONTRASENA]: 30 * 60_000,
  [PROPOSITO_ENLACE.CAMBIAR_CORREO]: 30 * 60_000,
};

/** Fallos de contraseña: desde el 5.º se espera entre intentos; desde el 10.º se pide Turnstile y se avisa. */
const FALLOS_PARA_ESPERAR = 5;
const FALLOS_PARA_DESAFIO = 10;

const CONTRASENA_FILTRADA =
  'Esta contraseña apareció en filtraciones de datos de otros sitios. Elige una distinta.';

export interface ResultadoIngreso {
  token: string;
  estado: SesionActiva['estado'];
  rol: SesionActiva['rol'];
  expiraEn: number;
}

const enlaceInvalido = () =>
  errorApi(
    HttpStatus.BAD_REQUEST,
    'ENLACE_INVALIDO',
    'Este enlace ya se usó o venció. Pide uno nuevo.',
  );

const desafioFallido = () =>
  errorApi(
    HttpStatus.BAD_REQUEST,
    'DESAFIO_FALLIDO',
    'No pudimos comprobar que no eres un robot. Intenta de nuevo.',
  );

const datosEnUso = () =>
  errorApi(
    HttpStatus.CONFLICT,
    'DATOS_EN_USO',
    'Ya hay una cuenta con esta cédula o este celular. Si es tuya, ingresa o recupera tu contraseña; si no, escríbenos a support@doctraderpro.com.',
  );

function esViolacionUnica(error: unknown): error is { constraint?: string } {
  return (error as { code?: string })?.code === '23505';
}

/** Filas afectadas de un UPDATE … RETURNING con `query()` de TypeORM (devuelve `[filas, cantidad]`). */
function filas<T>(resultado: unknown): T[] {
  return (resultado as [T[], number])[0];
}

/**
 * Registro, ingreso, segundo factor, confirmación reciente y recuperación de contraseña
 * (`docs/SEGURIDAD.md` §2 y §3).
 */
@Injectable()
export class AccesoService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly sesiones: SesionesService,
    private readonly cifrado: CifradoService,
    private readonly contrasenas: ContrasenasService,
    private readonly turnstile: TurnstileService,
    private readonly limites: LimitesService,
    private readonly avisos: AvisosService,
    private readonly auditoria: AuditoriaService,
    private readonly contenido: ContenidoService,
  ) {}

  // ── Registro y verificación del correo ──────────────────────────────────────────────────────────────

  /**
   * Crea la cuenta de un cliente y le envía el enlace para confirmar el correo. Si el correo ya está registrado,
   * responde igual que si fuera nuevo (para no revelar qué correos existen) y le avisa al dueño por correo.
   */
  async registrar(dto: RegistroDto, cliente: ContextoCliente): Promise<void> {
    await this.limites.exigir(LIMITES.registroPorIp, cliente.ip);
    if (!(await this.turnstile.valido(dto.turnstile, cliente.ip))) throw desafioFallido();

    const campos: Record<string, string> = {};
    const nombre = dto.nombre.trim().replace(/\s+/g, ' ');
    if (nombre.length < 3) campos.nombre = 'Escribe tu nombre completo.';
    const pais = (dto.documentoPais ?? 'CO').toUpperCase();
    const tipo = (dto.documentoTipo ?? 'CC').toUpperCase();
    const documento = validarDocumento(
      pais,
      tipo,
      // El campo viejo aceptaba la cédula con puntos o espacios: se le quitan como antes.
      dto.documento ?? dto.cedula?.replace(/[\s.,-]/g, '') ?? '',
    );
    if (!documento.ok) campos[documento.campo] = documento.mensaje;
    const telefono = normalizarTelefono(dto.telefono);
    if (!telefono) {
      campos.telefono =
        'Escribe un celular válido. Si no es de Colombia, empieza con + y el indicativo.';
    }
    let canonico = '';
    try {
      canonico = correoCanonico(dto.correo);
    } catch {
      campos.correo = 'Escribe un correo válido.';
    }
    const debil = problemaContrasena(dto.contrasena);
    if (debil) campos.contrasena = debil;
    if (Object.keys(campos).length > 0) throw errorDeCampos(campos);
    if (await this.contrasenas.estaFiltrada(dto.contrasena)) {
      throw errorDeCampos({ contrasena: CONTRASENA_FILTRADA });
    }
    // El hash se calcula siempre, también cuando el correo ya existe, para que las dos respuestas tarden lo mismo.
    const hash = await this.contrasenas.crearHash(dto.contrasena);

    const existente = await this.fuente.getRepository(User).findOneBy({ emailCanonical: canonico });
    if (existente) {
      if (existente.status !== ESTADO_USUARIO.BORRADO) await this.avisarYaRegistrado(existente);
      return;
    }

    const numero = documento.ok ? documento.numero : '';
    const cedulaHmac = this.cifrado.huella(CONTEXTO.cedula, claveDocumento(pais, tipo, numero));
    const repetido = await this.fuente
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.cedula_hmac = :cedulaHmac OR u.phone_e164 = :telefono', { cedulaHmac, telefono })
      .getExists();
    if (repetido) throw datosEnUso();

    try {
      await this.fuente.transaction(async (m) => {
        const referidor = await referidorParaRegistro(m, dto.codigoReferido);
        const usuario = await m.getRepository(User).save(
          m.getRepository(User).create({
            role: ROL.CLIENTE,
            fullName: nombre,
            cedulaEnc: this.cifrado.cifrar(numero, CONTEXTO.cedula),
            cedulaHmac,
            cedulaLast4: numero.slice(-4),
            documentCountry: pais,
            documentType: tipo,
            email: dto.correo.trim(),
            emailCanonical: canonico,
            phoneE164: telefono,
            passwordHash: hash,
            marketingOptIn: dto.aceptaMercadeo === true,
            referredBy: referidor?.id ?? null,
            referredAt: referidor ? new Date() : null,
          }),
        );

        // Cada autorización apunta a la versión exacta del texto vigente que la persona aceptó.
        const textos = await Promise.all(
          [
            TIPO_DOCUMENTO_LEGAL.TERMINOS,
            TIPO_DOCUMENTO_LEGAL.DATOS,
            TIPO_DOCUMENTO_LEGAL.RIESGO,
          ].map((tipo) => this.contenido.legalVigente(tipo, m).then((texto) => ({ tipo, texto }))),
        );
        await m.getRepository(Consent).insert([
          ...textos.map(({ tipo, texto }) => ({
            userId: usuario.id,
            type: tipo,
            legalDocumentId: texto?.id ?? null,
            documentVersion: texto ? String(texto.version) : null,
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          })),
          ...(dto.aceptaMercadeo
            ? [
                {
                  userId: usuario.id,
                  type: TIPO_CONSENTIMIENTO.MERCADEO,
                  legalDocumentId: null,
                  documentVersion: null,
                  ip: cliente.ip,
                  userAgent: cliente.userAgent ?? null,
                },
              ]
            : []),
        ]);

        const token = await this.crearEnlace(m, usuario.id, PROPOSITO_ENLACE.VERIFICAR_CORREO);
        await this.avisos.encolar(m, {
          usuarioId: usuario.id,
          correo: usuario.email,
          plantilla: PLANTILLA.VERIFICAR_CORREO,
          datos: { nombre: primerNombre(usuario.fullName) },
          secreto: token,
        });
        await this.auditoria.registrar(
          {
            actorId: usuario.id,
            actorRole: ROL.CLIENTE,
            action: 'usuario.registro',
            targetType: 'user',
            targetId: usuario.id,
            metadata: { mercadeo: usuario.marketingOptIn, referidoPor: referidor?.id ?? null },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
      });
    } catch (error) {
      // Dos registros al mismo tiempo con los mismos datos: la base de datos deja pasar solo uno.
      if (esViolacionUnica(error)) {
        if (error.constraint?.includes('email')) return;
        throw datosEnUso();
      }
      throw error;
    }
  }

  private async avisarYaRegistrado(usuario: User): Promise<void> {
    const hora = new Date().toISOString().slice(0, 13);
    await this.fuente.transaction((m) =>
      this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.YA_REGISTRADO,
        datos: { nombre: primerNombre(usuario.fullName) },
        clave: `ya-registrado:${usuario.id}:${hora}`,
      }),
    );
  }

  /** Crea un enlace de un solo uso y anula los anteriores del mismo propósito. Devuelve el secreto del enlace. */
  private async crearEnlace(
    m: EntityManager,
    usuarioId: string,
    proposito: PropositoEnlace,
  ): Promise<string> {
    await m
      .getRepository(AuthToken)
      .update({ userId: usuarioId, purpose: proposito, usedAt: IsNull() }, { usedAt: new Date() });
    const token = secretoAleatorio();
    await m.getRepository(AuthToken).insert({
      userId: usuarioId,
      purpose: proposito,
      tokenHash: this.cifrado.huella('enlace', token),
      expiresAt: new Date(Date.now() + VIGENCIA_ENLACE[proposito]),
    });
    return token;
  }

  async verificarCorreo(token: string, cliente: ContextoCliente): Promise<void> {
    await this.limites.exigir(LIMITES.enlacePorIp, cliente.ip);
    await this.fuente.transaction(async (m) => {
      const usados = filas<{ user_id: string }>(
        await m.query(
          `UPDATE auth_tokens SET used_at = now()
           WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
           RETURNING user_id`,
          [this.cifrado.huella('enlace', token), PROPOSITO_ENLACE.VERIFICAR_CORREO],
        ),
      );
      const usado = usados[0];
      if (!usado) throw enlaceInvalido();
      const verificado = filas<{ email: string; full_name: string; role: string }>(
        await m.query(
          `UPDATE users SET email_verified_at = now(), updated_at = now()
           WHERE id = $1 AND email_verified_at IS NULL
           RETURNING email, full_name, role`,
          [usado.user_id],
        ),
      )[0];
      // La bienvenida va una sola vez, al confirmar el correo por primera vez.
      if (verificado?.role === ROL.CLIENTE) {
        await this.avisos.encolar(m, {
          usuarioId: usado.user_id,
          correo: verificado.email,
          plantilla: PLANTILLA.BIENVENIDA,
          datos: { nombre: primerNombre(verificado.full_name) },
          clave: `bienvenida:${usado.user_id}`,
        });
      }
    });
  }

  /** Reenvía el enlace de verificación. Siempre responde igual, exista o no el correo. */
  async reenviarVerificacion(dto: CorreoDto, cliente: ContextoCliente): Promise<void> {
    const canonico = await this.revisarPedidoPorCorreo(dto, cliente);
    if (!canonico) return;
    const usuario = await this.fuente.getRepository(User).findOneBy({ emailCanonical: canonico });
    if (!usuario || usuario.emailVerifiedAt || usuario.status === ESTADO_USUARIO.BORRADO) return;
    await this.fuente.transaction(async (m) => {
      const token = await this.crearEnlace(m, usuario.id, PROPOSITO_ENLACE.VERIFICAR_CORREO);
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.VERIFICAR_CORREO,
        datos: { nombre: primerNombre(usuario.fullName) },
        secreto: token,
      });
    });
  }

  /** Límites y Turnstile de los pedidos que mandan un correo. Devuelve el correo canónico, o `null` si no vale. */
  private async revisarPedidoPorCorreo(
    dto: CorreoDto,
    cliente: ContextoCliente,
  ): Promise<string | null> {
    await this.limites.exigir(LIMITES.correoPorIp, cliente.ip);
    if (!(await this.turnstile.valido(dto.turnstile, cliente.ip))) throw desafioFallido();
    let canonico: string;
    try {
      canonico = correoCanonico(dto.correo);
    } catch {
      return null;
    }
    // Pasado el límite por cuenta no se envía nada más, pero la respuesta es la misma.
    const espera = await this.limites.consumir(LIMITES.correoPorCuenta, canonico);
    return espera > 0 ? null : canonico;
  }

  // ── Ingreso ──────────────────────────────────────────────────────────────────────────────────────────

  async ingresar(dto: IngresoDto, cliente: ContextoCliente): Promise<ResultadoIngreso> {
    await this.limites.exigir(LIMITES.ingresoPorIp, cliente.ip);
    let canonico: string;
    try {
      canonico = correoCanonico(dto.correo);
    } catch {
      throw credencialesInvalidas(false);
    }

    const claveFallos = `ingreso:fallos:${canonico}`;
    // La espera es por correo e IP: quien adivina desde otra IP no deja al dueño fuera de su cuenta. Los fallos sí
    // se cuentan por correo, para pedir el desafío y avisar al dueño sin importar desde dónde vengan.
    const claveEspera = `ingreso:espera:${canonico}:${cliente.ip}`;
    const espera = await this.redis.ttl(claveEspera);
    if (espera > 0) throw demasiadosIntentos(espera);

    const fallos = Number((await this.redis.get(claveFallos)) ?? 0);
    if (fallos >= FALLOS_PARA_DESAFIO && this.turnstile.activo) {
      if (!(await this.turnstile.valido(dto.turnstile, cliente.ip))) {
        throw errorApi(
          HttpStatus.BAD_REQUEST,
          'DESAFIO_REQUERIDO',
          'Por seguridad, completa el desafío antes de ingresar.',
          { desafio: true },
        );
      }
    }

    const encontrado = await this.fuente
      .getRepository(User)
      .findOneBy({ emailCanonical: canonico });
    const usuario = encontrado && encontrado.status !== ESTADO_USUARIO.BORRADO ? encontrado : null;
    // Siempre se verifica una contraseña, exista o no el usuario, para que la respuesta tarde lo mismo.
    const correcta = await this.contrasenas.coincide(usuario?.passwordHash ?? null, dto.contrasena);

    if (!usuario || !correcta) {
      const alerta = claveIngresosFallidos(new Date());
      const resultado = await this.redis
        .multi()
        .incr(claveFallos)
        .expire(claveFallos, 3_600)
        .incr(alerta)
        .expire(alerta, 3 * 3_600)
        .exec();
      const total = Number(resultado?.[0]?.[1] ?? 1);
      if (total >= FALLOS_PARA_ESPERAR) {
        const segundos = Math.min(30 * 2 ** (total - FALLOS_PARA_ESPERAR), 900);
        await this.redis.set(claveEspera, '1', 'EX', segundos);
      }
      if (total === FALLOS_PARA_DESAFIO && usuario) {
        await this.fuente.transaction((m) =>
          this.avisos.encolar(m, {
            usuarioId: usuario.id,
            correo: usuario.email,
            plantilla: PLANTILLA.INTENTOS_FALLIDOS,
            datos: { nombre: primerNombre(usuario.fullName) },
            clave: `intentos-fallidos:${usuario.id}:${new Date().toISOString().slice(0, 13)}`,
          }),
        );
      }
      throw credencialesInvalidas(total >= FALLOS_PARA_DESAFIO && this.turnstile.activo);
    }

    await this.redis.del(claveFallos, claveEspera);
    if (usuario.status === ESTADO_USUARIO.SUSPENDIDO) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida. Escríbenos a support@doctraderpro.com.',
      );
    }
    if (usuario.role === ROL.CLIENTE && !usuario.emailVerifiedAt) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        'CORREO_SIN_VERIFICAR',
        'Confirma tu correo para ingresar. Te enviamos un enlace al registrarte.',
      );
    }

    const estado = usuario.totpEnabledAt
      ? ESTADO_SESION.SEGUNDO_FACTOR_PENDIENTE
      : usuario.role === ROL.ADMIN
        ? ESTADO_SESION.SEGUNDO_FACTOR_POR_CONFIGURAR
        : ESTADO_SESION.COMPLETA;
    const dispositivo = dto.dispositivo
      ? this.cifrado.huella('dispositivo', dto.dispositivo).toString('base64url')
      : null;
    const { token, sesion } = await this.sesiones.crear(usuario, estado, cliente, dispositivo);
    if (estado === ESTADO_SESION.COMPLETA) await this.alCompletarIngreso(usuario, sesion, cliente);
    return resultado(token, sesion);
  }

  /** Paso 2 del ingreso: el código de la app o un código de recuperación. */
  async segundoFactor(
    sesion: SesionActiva,
    codigo: string,
    cliente: ContextoCliente,
  ): Promise<ResultadoIngreso> {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    const metodo = await this.revisarCodigo(usuario, codigo, true, cliente);
    if (!metodo) {
      sesion.intentosCodigo += 1;
      if (sesion.intentosCodigo >= MAXIMO_INTENTOS_CODIGO) {
        await this.sesiones.cerrar(sesion);
        throw errorApi(
          HttpStatus.UNAUTHORIZED,
          'SIN_SESION',
          'Demasiados códigos incorrectos. Ingresa de nuevo.',
        );
      }
      await this.sesiones.guardar(sesion);
      throw codigoInvalido();
    }
    // Al subir de nivel, la sesión cambia de token: un token visto antes del segundo factor ya no sirve.
    await this.sesiones.cerrar(sesion);
    const nueva = await this.sesiones.crear(
      usuario,
      ESTADO_SESION.COMPLETA,
      cliente,
      sesion.dispositivo,
    );
    await this.alCompletarIngreso(usuario, nueva.sesion, cliente, metodo);
    return resultado(nueva.token, nueva.sesion);
  }

  /** Registra el navegador (y avisa si es nuevo) y deja en la auditoría los ingresos de admins. */
  private async alCompletarIngreso(
    usuario: User,
    sesion: SesionActiva,
    cliente: ContextoCliente,
    metodo?: 'app' | 'recuperacion',
  ): Promise<void> {
    await this.fuente.transaction(async (m) => {
      if (sesion.dispositivo) {
        const registro = (await m.query(
          `INSERT INTO user_devices (user_id, device_hash, user_agent, last_ip)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, device_hash)
             DO UPDATE SET last_seen_at = now(), last_ip = EXCLUDED.last_ip, user_agent = EXCLUDED.user_agent
           RETURNING (xmax = 0) AS nuevo`,
          [
            usuario.id,
            Buffer.from(sesion.dispositivo, 'base64url'),
            cliente.userAgent ?? null,
            cliente.ip,
          ],
        )) as { nuevo: boolean }[];
        // `xmax = 0` solo en una fila recién insertada (no actualizada).
        const nuevo = registro[0]?.nuevo ?? false;
        if (nuevo) {
          const [{ cantidad }] = (await m.query(
            `SELECT count(*)::int AS cantidad FROM user_devices WHERE user_id = $1`,
            [usuario.id],
          )) as [{ cantidad: number }];
          // El primer navegador de la cuenta no es "nuevo": es el del registro.
          if (cantidad > 1) {
            await this.avisos.encolar(m, {
              usuarioId: usuario.id,
              correo: usuario.email,
              plantilla: PLANTILLA.NUEVO_INGRESO,
              datos: {
                nombre: primerNombre(usuario.fullName),
                fecha: fechaLegible(),
                navegador: sesion.navegador,
                ip: cliente.ip || 'desconocida',
              },
            });
          }
        }
      }
      if (usuario.role === ROL.ADMIN) {
        await this.auditoria.registrar(
          {
            actorId: usuario.id,
            actorRole: usuario.role,
            action: 'auth.ingreso',
            targetType: 'user',
            targetId: usuario.id,
            metadata: { navegador: sesion.navegador, ...(metodo ? { segundoFactor: metodo } : {}) },
            ip: cliente.ip,
            userAgent: cliente.userAgent ?? null,
          },
          m,
        );
      }
    });
  }

  /**
   * Revisa un código del segundo factor. Un código de la app no se acepta dos veces; un código de recuperación
   * se gasta y se avisa por correo. Devuelve cómo se verificó, o `null` si no vale.
   */
  /**
   * Revisa un código con un límite por usuario, compartido por todas sus sesiones y atómico: cada intento se reserva
   * en Redis antes de comparar, así ni muchas peticiones al mismo tiempo ni varias sesiones pasan de
   * `MAXIMO_CODIGOS_POR_HORA` intentos. Un código correcto reinicia la cuenta.
   */
  private async revisarCodigo(
    usuario: User,
    codigo: string,
    permitirRecuperacion: boolean,
    cliente: ContextoCliente,
  ): Promise<'app' | 'recuperacion' | null> {
    const clave = `codigo:intentos:${usuario.id}`;
    const intentos = await this.redis.incr(clave);
    if (intentos === 1) await this.redis.expire(clave, 3_600);
    if (intentos > MAXIMO_CODIGOS_POR_HORA) {
      throw errorApi(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADOS_CODIGOS',
        'Demasiados códigos incorrectos. Espera una hora e intenta de nuevo.',
      );
    }
    const metodo = await this.compararCodigo(usuario, codigo, permitirRecuperacion, cliente);
    if (metodo) await this.redis.del(clave);
    return metodo;
  }

  private async compararCodigo(
    usuario: User,
    codigo: string,
    permitirRecuperacion: boolean,
    cliente: ContextoCliente,
  ): Promise<'app' | 'recuperacion' | null> {
    if (!usuario.totpSecretEnc || !usuario.totpEnabledAt) return null;
    const limpio = codigo.replace(/\s/g, '');

    if (/^\d{6}$/.test(limpio)) {
      const secreto = this.cifrado.descifrar(usuario.totpSecretEnc, CONTEXTO.totp);
      return (await this.marcarPeriodo(usuario.id, periodoDelCodigo(secreto, limpio)))
        ? 'app'
        : null;
    }

    if (!permitirRecuperacion) return null;
    const normal = normalizarCodigoRecuperacion(limpio);
    if (!normal) return null;
    return this.fuente.transaction(async (m) => {
      const gastados = filas<{ id: string }>(
        await m.query(
          `UPDATE recovery_codes SET used_at = now()
           WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id`,
          [usuario.id, this.huellaRecuperacion(usuario.id, normal)],
        ),
      );
      if (gastados.length === 0) return null;
      const restantes = await m
        .getRepository(RecoveryCode)
        .countBy({ userId: usuario.id, usedAt: IsNull() });
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.CODIGO_RECUPERACION_USADO,
        datos: {
          nombre: primerNombre(usuario.fullName),
          fecha: fechaLegible(),
          restantes: String(restantes),
        },
      });
      await this.auditoria.registrar(
        {
          actorId: usuario.id,
          actorRole: usuario.role,
          action: 'auth.codigo_recuperacion_usado',
          targetType: 'user',
          targetId: usuario.id,
          metadata: { restantes },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return 'recuperacion' as const;
    });
  }

  /** Marca el periodo de un código de la app como usado. `false` si el código no valía o ya se usó. */
  private async marcarPeriodo(usuarioId: string, periodo: number | null): Promise<boolean> {
    if (periodo === null) return false;
    const marcado = await this.redis.set(
      `totp:usado:${usuarioId}:${periodo}`,
      '1',
      'EX',
      180,
      'NX',
    );
    return marcado === 'OK';
  }

  private huellaRecuperacion(usuarioId: string, codigo: string): Buffer {
    return this.cifrado.huella('recuperacion', `${usuarioId}:${codigo}`);
  }

  async salir(sesion: SesionActiva): Promise<void> {
    await this.sesiones.cerrar(sesion);
  }

  async datosDeSesion(sesion: SesionActiva) {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    // Para el punto de la pestaña Soporte: respuestas que el cliente no ha atendido, o tickets sin responder (admins).
    const [{ soporte }] =
      sesion.estado === ESTADO_SESION.COMPLETA
        ? ((await this.fuente.query(
            usuario.role === ROL.ADMIN
              ? `SELECT count(*)::int AS soporte FROM tickets WHERE status = 'ABIERTO'`
              : `SELECT count(*)::int AS soporte FROM tickets WHERE user_id = $1 AND status = 'RESPONDIDO'`,
            usuario.role === ROL.ADMIN ? [] : [usuario.id],
          )) as { soporte: number }[])
        : [{ soporte: 0 }];
    return {
      soporte,
      estado: sesion.estado,
      expiraEn: sesion.expiraEn,
      confirmadaHasta: sesion.confirmadaHasta,
      usuario: {
        id: usuario.id,
        nombre: usuario.fullName,
        correo: usuario.email,
        rol: usuario.role,
        segundoFactor: usuario.totpEnabledAt !== null,
      },
    };
  }

  /** Los datos del perfil: la cédula solo con sus últimos 4 dígitos. */
  async perfil(sesion: SesionActiva) {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    return {
      nombre: usuario.fullName,
      correo: usuario.email,
      telefono: usuario.phoneE164,
      cedulaUltimos4: usuario.cedulaLast4,
      documentoPais: usuario.documentCountry,
      documentoTipo: usuario.documentType,
      clienteDesde: usuario.createdAt,
      segundoFactor: usuario.totpEnabledAt !== null,
    };
  }

  // ── Segundo factor y confirmación reciente ───────────────────────────────────────────────────────────

  /** Genera un secreto nuevo (todavía sin activar) y su código QR. Vale 15 minutos. */
  async configurarSegundoFactor(sesion: SesionActiva) {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    // Cambiar un segundo factor que ya funciona es una acción delicada.
    if (usuario.totpEnabledAt && sesion.confirmadaHasta <= Date.now()) {
      throw errorApi(
        HttpStatus.FORBIDDEN,
        'CONFIRMACION_REQUERIDA',
        'Por seguridad, confirma que eres tú antes de continuar.',
      );
    }
    const secreto = nuevoSecretoTotp();
    await this.redis.set(
      `totp:pendiente:${usuario.id}`,
      this.cifrado.cifrar(secreto, CONTEXTO.totpPendiente).toString('base64'),
      'EX',
      900,
    );
    const enlace = enlaceTotp(secreto, usuario.email);
    return {
      secreto,
      enlace,
      qr: await QRCode.toDataURL(enlace, { margin: 1, width: 240, errorCorrectionLevel: 'M' }),
    };
  }

  /**
   * Activa el segundo factor con el primer código de la app. Cierra las demás sesiones, crea códigos de
   * recuperación nuevos y devuelve una sesión nueva ya confirmada.
   */
  async activarSegundoFactor(sesion: SesionActiva, codigo: string, cliente: ContextoCliente) {
    const clave = `totp:pendiente:${sesion.usuarioId}`;
    const pendiente = await this.redis.get(clave);
    if (!pendiente) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'CONFIGURACION_VENCIDA',
        'El código QR venció. Empieza de nuevo.',
      );
    }
    const secreto = this.cifrado.descifrar(
      Buffer.from(pendiente, 'base64'),
      CONTEXTO.totpPendiente,
    );
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    if (
      !(await this.marcarPeriodo(usuario.id, periodoDelCodigo(secreto, codigo.replace(/\s/g, ''))))
    ) {
      throw codigoInvalido();
    }

    const codigos = nuevosCodigosRecuperacion();
    await this.fuente.transaction(async (m) => {
      await m.getRepository(User).update(usuario.id, {
        totpSecretEnc: this.cifrado.cifrar(secreto, CONTEXTO.totp),
        totpEnabledAt: new Date(),
      });
      await this.guardarCodigos(m, usuario.id, codigos);
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.SEGUNDO_FACTOR_ACTIVADO,
        datos: { nombre: primerNombre(usuario.fullName), fecha: fechaLegible() },
      });
      await this.auditoria.registrar(
        {
          actorId: usuario.id,
          actorRole: usuario.role,
          action: 'auth.segundo_factor_activado',
          targetType: 'user',
          targetId: usuario.id,
          metadata: { reemplazo: usuario.totpEnabledAt !== null },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    await this.redis.del(clave);

    await this.sesiones.cerrarTodas(usuario.id);
    const nueva = await this.sesiones.crear(
      usuario,
      ESTADO_SESION.COMPLETA,
      cliente,
      sesion.dispositivo,
    );
    nueva.sesion.confirmadaHasta = Date.now() + DURACION_CONFIRMACION * 1000;
    await this.sesiones.guardar(nueva.sesion);
    if (sesion.estado === ESTADO_SESION.SEGUNDO_FACTOR_POR_CONFIGURAR) {
      await this.alCompletarIngreso(usuario, nueva.sesion, cliente, 'app');
    }
    return { ...resultado(nueva.token, nueva.sesion), codigos };
  }

  private async guardarCodigos(m: EntityManager, usuarioId: string, codigos: string[]) {
    await m.getRepository(RecoveryCode).delete({ userId: usuarioId });
    await m.getRepository(RecoveryCode).insert(
      codigos.map((codigo) => ({
        userId: usuarioId,
        codeHash: this.huellaRecuperacion(usuarioId, codigo),
      })),
    );
  }

  /**
   * Confirmación reciente para acciones delicadas: el código de la app si tiene segundo factor; si no, la
   * contraseña. Vale 5 minutos.
   */
  async confirmar(sesion: SesionActiva, dto: ConfirmarDto, cliente: ContextoCliente) {
    await this.limites.exigir(LIMITES.confirmarPorUsuario, sesion.usuarioId);
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    const conApp = usuario.totpEnabledAt !== null;
    const correcto = conApp
      ? dto.codigo !== undefined &&
        (await this.revisarCodigo(usuario, dto.codigo, false, cliente)) !== null
      : dto.contrasena !== undefined &&
        (await this.contrasenas.coincide(usuario.passwordHash, dto.contrasena));
    if (!correcto) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'CONFIRMACION_FALLIDA',
        conApp ? 'El código no es correcto o ya se usó.' : 'La contraseña no es correcta.',
      );
    }
    sesion.confirmadaHasta = Date.now() + DURACION_CONFIRMACION * 1000;
    await this.sesiones.guardar(sesion);
    return { confirmadaHasta: sesion.confirmadaHasta };
  }

  async regenerarCodigos(sesion: SesionActiva, cliente: ContextoCliente) {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id: sesion.usuarioId });
    if (!usuario.totpEnabledAt) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'SIN_SEGUNDO_FACTOR',
        'Primero activa el segundo factor.',
      );
    }
    const codigos = nuevosCodigosRecuperacion();
    await this.fuente.transaction(async (m) => {
      await this.guardarCodigos(m, usuario.id, codigos);
      await this.auditoria.registrar(
        {
          actorId: usuario.id,
          actorRole: usuario.role,
          action: 'auth.codigos_regenerados',
          targetType: 'user',
          targetId: usuario.id,
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    return { codigos };
  }

  // ── Recuperar la contraseña ──────────────────────────────────────────────────────────────────────────

  /** Envía el enlace para crear una contraseña nueva. Siempre responde igual, exista o no el correo. */
  async recuperar(dto: CorreoDto, cliente: ContextoCliente): Promise<void> {
    const canonico = await this.revisarPedidoPorCorreo(dto, cliente);
    if (!canonico) return;
    const usuario = await this.fuente.getRepository(User).findOneBy({ emailCanonical: canonico });
    if (!usuario || usuario.status === ESTADO_USUARIO.BORRADO) return;
    await this.fuente.transaction(async (m) => {
      const token = await this.crearEnlace(m, usuario.id, PROPOSITO_ENLACE.RESTABLECER_CONTRASENA);
      await this.avisos.encolar(m, {
        usuarioId: usuario.id,
        correo: usuario.email,
        plantilla: PLANTILLA.RESTABLECER_CONTRASENA,
        datos: { nombre: primerNombre(usuario.fullName) },
        secreto: token,
      });
    });
  }

  /**
   * Crea la contraseña nueva con el enlace del correo. También confirma el correo (quien abrió el enlace tiene el
   * buzón) y cierra todas las sesiones. Así entran por primera vez los admins creados por la semilla.
   */
  async restablecer(dto: RestablecerDto, cliente: ContextoCliente): Promise<void> {
    await this.limites.exigir(LIMITES.enlacePorIp, cliente.ip);
    const tokenHash = this.cifrado.huella('enlace', dto.token);
    const vigente = await this.fuente.getRepository(AuthToken).findOneBy({
      tokenHash,
      purpose: PROPOSITO_ENLACE.RESTABLECER_CONTRASENA,
      usedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    if (!vigente) throw enlaceInvalido();
    const debil = problemaContrasena(dto.contrasena);
    if (debil) throw errorDeCampos({ contrasena: debil });
    if (await this.contrasenas.estaFiltrada(dto.contrasena)) {
      throw errorDeCampos({ contrasena: CONTRASENA_FILTRADA });
    }
    const hash = await this.contrasenas.crearHash(dto.contrasena);

    const usuario = await this.fuente.transaction(async (m) => {
      const usados = filas<{ user_id: string }>(
        await m.query(
          `UPDATE auth_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING user_id`,
          [vigente.id],
        ),
      );
      if (usados.length === 0) throw enlaceInvalido();
      const cuenta = await m.getRepository(User).findOneByOrFail({ id: vigente.userId });
      if (cuenta.status === ESTADO_USUARIO.BORRADO) throw enlaceInvalido();
      await m.query(
        `UPDATE users SET password_hash = $2, email_verified_at = coalesce(email_verified_at, now()),
           updated_at = now() WHERE id = $1`,
        [cuenta.id, hash],
      );
      await this.avisos.encolar(m, {
        usuarioId: cuenta.id,
        correo: cuenta.email,
        plantilla: PLANTILLA.CONTRASENA_CAMBIADA,
        datos: { nombre: primerNombre(cuenta.fullName), fecha: fechaLegible() },
      });
      await this.auditoria.registrar(
        {
          actorId: cuenta.id,
          actorRole: cuenta.role,
          action: 'auth.contrasena_restablecida',
          targetType: 'user',
          targetId: cuenta.id,
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return cuenta;
    });

    const esperas = await this.redis.keys(`ingreso:espera:${usuario.emailCanonical}:*`);
    await this.redis.del(`ingreso:fallos:${usuario.emailCanonical}`, ...esperas);
    await this.sesiones.cerrarTodas(usuario.id);
  }
}

/** Códigos del segundo factor por usuario y por hora, sumando todas sus sesiones (`docs/SEGURIDAD.md` §3). */
const MAXIMO_CODIGOS_POR_HORA = 10;

function resultado(token: string, sesion: SesionActiva): ResultadoIngreso {
  return { token, estado: sesion.estado, rol: sesion.rol, expiraEn: sesion.expiraEn };
}

function credencialesInvalidas(desafio: boolean) {
  return errorApi(
    HttpStatus.UNAUTHORIZED,
    'CREDENCIALES_INVALIDAS',
    'El correo o la contraseña no son correctos.',
    desafio ? { desafio: true } : {},
  );
}

function codigoInvalido() {
  return errorApi(
    HttpStatus.BAD_REQUEST,
    'CODIGO_INVALIDO',
    'El código no es correcto o ya se usó. Revisa la hora de tu celular si el problema sigue.',
  );
}
