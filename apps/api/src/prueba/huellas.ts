import { createHmac } from 'node:crypto';
import {
  claveDeCuenta,
  correoCanonico,
  normalizarCedula,
  normalizarParaComparar,
  type Red,
  TIPO_HUELLA,
  type TipoHuella,
} from '@doctrader/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import type { Entorno } from '../config/entorno.js';

/** Versión de `TRIAL_HMAC_KEY`. Para rotarla se agrega una versión nueva y se comparan las dos (SEGURIDAD §4.4). */
export const VERSION_LLAVE_PRUEBA = 1;

export interface DatosHuella {
  tipo: TipoHuella;
  valor: string;
}

/** Lo que identifica a una persona y su cuenta para el control de la prueba, ya normalizado. */
export function datosDeLaPrueba(d: {
  cedula: string | null;
  correo: string;
  telefono: string | null;
  broker: string;
  servidor: string;
  numero: string;
  dispositivo: string | null;
}): DatosHuella[] {
  const cedula = d.cedula ? normalizarCedula(d.cedula) : null;
  return [
    ...(cedula ? [{ tipo: TIPO_HUELLA.CEDULA, valor: cedula }] : []),
    { tipo: TIPO_HUELLA.CUENTA, valor: claveDeCuenta(d.broker, d.servidor, d.numero) },
    { tipo: TIPO_HUELLA.CORREO, valor: correoCanonico(d.correo) },
    ...(d.telefono ? [{ tipo: TIPO_HUELLA.TELEFONO, valor: d.telefono }] : []),
    { tipo: TIPO_HUELLA.NUMERO_CUENTA, valor: normalizarParaComparar(d.numero) },
    ...(d.dispositivo ? [{ tipo: TIPO_HUELLA.DISPOSITIVO, valor: d.dispositivo }] : []),
  ];
}

/** Una billetera de origen, con su red: las direcciones de Bitcoin segwit no distinguen mayúsculas. */
export function datoBilletera(red: Red, direccion: string): DatosHuella {
  const limpia = /^bc1/i.test(direccion) ? direccion.toLowerCase() : direccion;
  return { tipo: TIPO_HUELLA.BILLETERA, valor: `${red}:${limpia}` };
}

/**
 * Huellas del control de la prueba: HMAC-SHA256 con `TRIAL_HMAC_KEY`, una llave propia distinta de la de buscar
 * datos cifrados. Lo que queda en `trial_registry` no deja recuperar la cédula ni el correo.
 */
@Injectable()
export class HuellasPrueba {
  private readonly llave: Buffer | null;

  constructor(config: ConfigService<Entorno, true>) {
    const llave = config.get('TRIAL_HMAC_KEY', { infer: true });
    this.llave = llave ? Buffer.from(llave, 'base64') : null;
  }

  /** Sin llave no se pueden comparar huellas: la prueba queda cerrada. */
  get disponible(): boolean {
    return this.llave !== null;
  }

  huella({ tipo, valor }: DatosHuella): Buffer {
    if (!this.llave) throw new Error('Falta TRIAL_HMAC_KEY');
    return createHmac('sha256', this.llave).update(`${tipo}:${valor}`).digest();
  }

  /** Qué huellas ya están en el registro, con la solicitud de la prueba a la que pertenecen. */
  async buscar(
    m: EntityManager,
    datos: DatosHuella[],
  ): Promise<{ tipo: TipoHuella; solicitudId: string }[]> {
    if (datos.length === 0) return [];
    const filas = (await m.query(
      `SELECT kind, trial_request_id FROM trial_registry
        WHERE (kind, fingerprint) IN (SELECT * FROM unnest($1::text[], $2::bytea[]))
          AND key_version = $3`,
      [datos.map((d) => d.tipo), datos.map((d) => this.huella(d)), VERSION_LLAVE_PRUEBA],
    )) as { kind: TipoHuella; trial_request_id: string }[];
    return filas.map((f) => ({ tipo: f.kind, solicitudId: f.trial_request_id }));
  }

  async registrar(m: EntityManager, solicitudId: string, datos: DatosHuella[]): Promise<void> {
    if (datos.length === 0) return;
    await m.query(
      `INSERT INTO trial_registry (kind, fingerprint, key_version, trial_request_id)
       SELECT kind, fingerprint, $3, $4 FROM unnest($1::text[], $2::bytea[]) AS t(kind, fingerprint)
       ON CONFLICT DO NOTHING`,
      [
        datos.map((d) => d.tipo),
        datos.map((d) => this.huella(d)),
        VERSION_LLAVE_PRUEBA,
        solicitudId,
      ],
    );
  }
}
