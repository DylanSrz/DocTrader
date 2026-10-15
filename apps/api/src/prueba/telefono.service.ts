import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { User } from '../database/entidades/index.js';
import { errorApi } from '../seguridad/errores.js';
import { LimitesService, type Regla } from '../seguridad/limites.service.js';
import { TurnstileService } from '../seguridad/turnstile.service.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';
import { ErrorSms, ProveedorSms } from './sms.js';

/** Límites de `docs/SEGURIDAD.md` §9: cada SMS cuesta, y los bots los piden para cobrarle a la cuenta. */
const LIMITES_SMS = {
  porTelefonoHora: { nombre: 'sms-tel-hora', maximo: 3, ventana: 3_600 },
  porTelefonoDia: { nombre: 'sms-tel-dia', maximo: 5, ventana: 86_400 },
  porIp: { nombre: 'sms-ip', maximo: 10, ventana: 3_600 },
  intentosCodigo: { nombre: 'sms-codigo', maximo: 8, ventana: 900 },
} satisfies Record<string, Regla>;

function smsNoDisponible() {
  return errorApi(
    HttpStatus.SERVICE_UNAVAILABLE,
    'SMS_NO_DISPONIBLE',
    'Por ahora no podemos enviar SMS. Intenta más tarde o escríbenos a soporte.',
  );
}

/** Verificar el teléfono con un código por SMS. Hoy solo se pide para solicitar la prueba. */
@Injectable()
export class TelefonoService {
  private readonly logger = new Logger(TelefonoService.name);

  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly sms: ProveedorSms,
    private readonly limites: LimitesService,
    private readonly turnstile: TurnstileService,
    private readonly auditoria: AuditoriaService,
  ) {}

  get disponible(): boolean {
    return this.sms.disponible;
  }

  private async usuario(id: string): Promise<User> {
    const usuario = await this.fuente.getRepository(User).findOneByOrFail({ id });
    if (!usuario.phoneE164) {
      throw errorApi(
        HttpStatus.CONFLICT,
        'SIN_TELEFONO',
        'Tu cuenta no tiene un teléfono. Escríbenos a soporte para agregarlo.',
      );
    }
    if (usuario.phoneVerifiedAt) {
      throw errorApi(HttpStatus.CONFLICT, 'YA_VERIFICADO', 'Tu teléfono ya está verificado.');
    }
    return usuario;
  }

  async enviarCodigo(sesion: SesionActiva, cliente: ContextoCliente, turnstile?: string) {
    if (!this.sms.disponible) throw smsNoDisponible();
    const usuario = await this.usuario(sesion.usuarioId);
    if (!(await this.turnstile.valido(turnstile, cliente.ip))) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'DESAFIO_FALLIDO',
        'No pudimos comprobar que no eres un robot. Intenta de nuevo.',
      );
    }
    const telefono = createHash('sha256').update(usuario.phoneE164!).digest('hex');
    await this.limites.exigir(LIMITES_SMS.porIp, cliente.ip);
    await this.limites.exigir(LIMITES_SMS.porTelefonoHora, telefono);
    await this.limites.exigir(LIMITES_SMS.porTelefonoDia, telefono);
    try {
      await this.sms.enviar(usuario.phoneE164!);
    } catch (error) {
      if (!(error instanceof ErrorSms)) throw error;
      this.logger.warn(error.message);
      throw errorApi(
        HttpStatus.BAD_GATEWAY,
        'SMS_FALLIDO',
        'No pudimos enviar el SMS. Revisa que tu número esté bien o intenta en unos minutos.',
      );
    }
    return { enviado: true };
  }

  async verificar(sesion: SesionActiva, cliente: ContextoCliente, codigo: string) {
    if (!this.sms.disponible) throw smsNoDisponible();
    const usuario = await this.usuario(sesion.usuarioId);
    await this.limites.exigir(LIMITES_SMS.intentosCodigo, usuario.id);
    let valido: boolean;
    try {
      valido = await this.sms.comprobar(usuario.phoneE164!, codigo);
    } catch (error) {
      if (!(error instanceof ErrorSms)) throw error;
      this.logger.warn(error.message);
      throw errorApi(
        HttpStatus.BAD_GATEWAY,
        'SMS_FALLIDO',
        'No pudimos revisar el código. Intenta de nuevo en unos minutos.',
      );
    }
    if (!valido) {
      throw errorApi(
        HttpStatus.BAD_REQUEST,
        'CODIGO_INVALIDO',
        'El código no es correcto o ya venció. Revisa el SMS o pide uno nuevo.',
        { campos: { codigo: 'El código no es correcto o ya venció.' } },
      );
    }
    await this.fuente.transaction(async (m) => {
      await m.getRepository(User).update({ id: usuario.id }, { phoneVerifiedAt: new Date() });
      await this.auditoria.registrar(
        {
          actorId: usuario.id,
          actorRole: sesion.rol,
          action: 'usuario.telefono_verificado',
          targetType: 'user',
          targetId: usuario.id,
          metadata: {},
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    return { verificado: true };
  }
}
