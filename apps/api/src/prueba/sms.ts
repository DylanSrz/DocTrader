import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Entorno } from '../config/entorno.js';
import { REDIS } from '../redis/redis.module.js';

/**
 * Envío y verificación de códigos por SMS. Detrás de esta interfaz, para poder cambiar de proveedor
 * (`docs/DECISIONES-TECNICAS.md` §1).
 */
export abstract class ProveedorSms {
  /** `false` si no hay proveedor configurado (producción sin Twilio): no se envían SMS. */
  abstract readonly disponible: boolean;
  /** Envía un código al teléfono (formato internacional, `+573001234567`). */
  abstract enviar(telefono: string): Promise<void>;
  /** `true` si el código es el último que se envió a ese teléfono y no ha vencido. */
  abstract comprobar(telefono: string, codigo: string): Promise<boolean>;
}

/** El proveedor no respondió o rechazó el envío: se le dice al cliente que intente más tarde. */
export class ErrorSms extends Error {}

/**
 * Twilio Verify: Twilio genera el código, lo envía y lo valida (con su protección contra el fraude de SMS). La API
 * es HTTP con autenticación básica; no hace falta su librería.
 */
export class TwilioVerify extends ProveedorSms {
  readonly disponible = true;
  private readonly logger = new Logger(TwilioVerify.name);

  constructor(
    private readonly cuenta: string,
    private readonly token: string,
    private readonly servicio: string,
  ) {
    super();
  }

  private async llamar(ruta: string, campos: Record<string, string>) {
    const respuesta = await fetch(
      `https://verify.twilio.com/v2/Services/${this.servicio}/${ruta}`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.cuenta}:${this.token}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(campos),
        signal: AbortSignal.timeout(10_000),
      },
    ).catch((error: unknown) => {
      throw new ErrorSms(`Twilio no respondió: ${(error as Error).message}`);
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      status?: string;
      code?: number;
      message?: string;
    };
    return { estado: respuesta.status, cuerpo };
  }

  async enviar(telefono: string): Promise<void> {
    const { estado, cuerpo } = await this.llamar('Verifications', {
      To: telefono,
      Channel: 'sms',
      Locale: 'es',
    });
    if (estado >= 300) {
      // 60203: demasiados envíos al mismo número; 60410: número bloqueado por fraude.
      this.logger.warn(`Twilio rechazó el envío (${estado}, ${cuerpo.code}): ${cuerpo.message}`);
      throw new ErrorSms(`Twilio rechazó el envío (${cuerpo.code ?? estado})`);
    }
  }

  async comprobar(telefono: string, codigo: string): Promise<boolean> {
    const { estado, cuerpo } = await this.llamar('VerificationCheck', {
      To: telefono,
      Code: codigo,
    });
    // 404: no hay una verificación en curso (venció o ya se usó).
    if (estado === 404) return false;
    if (estado >= 300)
      throw new ErrorSms(`Twilio no pudo revisar el código (${cuerpo.code ?? estado})`);
    return cuerpo.status === 'approved';
  }
}

const VIGENCIA_CODIGO = 600;

/**
 * Para desarrollo y pruebas: el código se guarda (como hash) en Redis por 10 minutos y se escribe en el registro de
 * la API. Nunca se usa en producción.
 */
export class SmsDeConsola extends ProveedorSms {
  readonly disponible = true;
  private readonly logger = new Logger('SMS');
  /** El último código de cada teléfono, para las pruebas automáticas. */
  readonly ultimos = new Map<string, string>();

  constructor(private readonly redis: Redis) {
    super();
  }

  private clave(telefono: string) {
    return `sms:codigo:${createHash('sha256').update(telefono).digest('hex')}`;
  }

  async enviar(telefono: string): Promise<void> {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis.set(
      this.clave(telefono),
      createHash('sha256').update(codigo).digest('hex'),
      'EX',
      VIGENCIA_CODIGO,
    );
    this.ultimos.set(telefono, codigo);
    this.logger.log(`Código para ${telefono}: ${codigo}`);
  }

  async comprobar(telefono: string, codigo: string): Promise<boolean> {
    const guardado = await this.redis.get(this.clave(telefono));
    if (!guardado) return false;
    const escrito = createHash('sha256').update(codigo).digest('hex');
    const bien = timingSafeEqual(Buffer.from(guardado), Buffer.from(escrito));
    if (bien) await this.redis.del(this.clave(telefono));
    return bien;
  }
}

/** Producción sin Twilio configurado: no hay SMS. */
export class SinSms extends ProveedorSms {
  readonly disponible = false;
  enviar(): Promise<void> {
    return Promise.reject(new ErrorSms('No hay proveedor de SMS configurado'));
  }
  comprobar(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

/** Elige el proveedor según las variables de entorno. */
@Injectable()
export class FabricaSms {
  constructor(
    private readonly config: ConfigService<Entorno, true>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  crear(): ProveedorSms {
    const cuenta = this.config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = this.config.get('TWILIO_AUTH_TOKEN', { infer: true });
    const servicio = this.config.get('TWILIO_VERIFY_SERVICE_SID', { infer: true });
    if (cuenta && token && servicio) return new TwilioVerify(cuenta, token, servicio);
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      new Logger('SMS').warn('SMS desactivados: faltan las variables de Twilio');
      return new SinSms();
    }
    return new SmsDeConsola(this.redis);
  }
}
