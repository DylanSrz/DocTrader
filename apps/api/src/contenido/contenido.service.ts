import {
  DOCUMENTOS_LEGALES,
  dolaresPorMes,
  type PreguntaFrecuente,
  PREGUNTAS_INICIALES,
  TIPO_DOCUMENTO_LEGAL,
  type TipoDocumentoLegal,
} from '@doctrader/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { LegalDocument, Plan, Setting } from '../database/entidades/index.js';
import type { ValorJson } from '../database/entidades/setting.entity.js';
import { errorApi } from '../seguridad/errores.js';
import type { ContextoCliente, SesionActiva } from '../sesiones/sesiones.service.js';

export interface Enlaces {
  telegram: string;
  instagram: string;
  broker: { name: string; url: string };
}

export interface CifrasMyfxbook {
  url: string;
  figures: {
    gainPercent: string | null;
    maxDrawdownPercent: string | null;
    auditedSince: string | null;
    asOf: string | null;
  };
}

/** La versión vigente de un texto legal, para la página pública y para el registro. */
export interface TextoLegal {
  id: string;
  tipo: TipoDocumentoLegal;
  version: number;
  publicadoEn: Date;
  contenido: string;
}

const CLAVES_LANDING = ['faq', 'links', 'myfxbook', 'support_email'] as const;

/** Lo que muestra la página pública (planes, preguntas, cifras, enlaces) y los textos legales con versiones. */
@Injectable()
export class ContenidoService {
  constructor(
    @InjectDataSource() private readonly fuente: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async ajustes(): Promise<Map<string, ValorJson>> {
    const filas = await this.fuente
      .getRepository(Setting)
      .createQueryBuilder('s')
      .where('s.key IN (:...claves)', { claves: CLAVES_LANDING })
      .getMany();
    return new Map(filas.map((f) => [f.key, f.value]));
  }

  async landing() {
    const [planes, ajustes] = await Promise.all([
      this.fuente.getRepository(Plan).find({ where: { isActive: true }, order: { rank: 'ASC' } }),
      this.ajustes(),
    ]);
    return {
      planes: planes.map((p) => ({
        codigo: p.code,
        nombre: p.name,
        meses: p.durationMonths,
        mesesObsequio: p.bonusMonths,
        dias: p.durationDays,
        precioUsdCentavos: p.priceUsdCents,
        dolaresPorMes: dolaresPorMes(p),
        publico: p.isPublic,
      })),
      preguntas: (ajustes.get('faq') as PreguntaFrecuente[] | undefined) ?? [
        ...PREGUNTAS_INICIALES,
      ],
      myfxbook: (ajustes.get('myfxbook') as CifrasMyfxbook | undefined) ?? null,
      enlaces: (ajustes.get('links') as Enlaces | undefined) ?? null,
      correoSoporte:
        (ajustes.get('support_email') as string | undefined) ?? 'support@doctraderpro.com',
    };
  }

  // ── Textos legales ──────────────────────────────────────────────────────────────────────────────────

  async legalVigente(tipo: TipoDocumentoLegal, m?: EntityManager): Promise<TextoLegal | null> {
    const doc = await (m ?? this.fuente.manager)
      .getRepository(LegalDocument)
      .findOne({ where: { type: tipo }, order: { version: 'DESC' } });
    return doc
      ? {
          id: doc.id,
          tipo: doc.type,
          version: doc.version,
          publicadoEn: doc.publishedAt,
          contenido: doc.contentMd,
        }
      : null;
  }

  /** Busca un texto por su ruta pública (`terminos`, `datos`, `riesgo`). */
  async legalPorRuta(ruta: string): Promise<TextoLegal> {
    const tipo = (Object.keys(DOCUMENTOS_LEGALES) as TipoDocumentoLegal[]).find(
      (t) => DOCUMENTOS_LEGALES[t].ruta === ruta,
    );
    const doc = tipo ? await this.legalVigente(tipo) : null;
    if (!doc) throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontrado.');
    return doc;
  }

  async listarLegales(): Promise<(TextoLegal | null)[]> {
    return Promise.all(Object.values(TIPO_DOCUMENTO_LEGAL).map((t) => this.legalVigente(t)));
  }

  /**
   * Publica una versión nueva de un texto legal. La anterior queda guardada tal cual: las autorizaciones viejas
   * siguen apuntando al texto que la persona aceptó.
   */
  async publicarLegal(
    tipo: TipoDocumentoLegal,
    contenido: string,
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ): Promise<TextoLegal> {
    if (!Object.values(TIPO_DOCUMENTO_LEGAL).includes(tipo)) {
      throw errorApi(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No encontrado.');
    }
    const limpio = contenido.replace(/\r\n/g, '\n').trim();
    return this.fuente.transaction(async (m) => {
      // Un candado por tipo: dos publicaciones al mismo tiempo no pueden sacar el mismo número de versión.
      await m.query(`SELECT pg_advisory_xact_lock(7321002, hashtext($1))`, [tipo]);
      const anterior = await this.legalVigente(tipo, m);
      if (anterior?.contenido === limpio) {
        throw errorApi(
          HttpStatus.BAD_REQUEST,
          'SIN_CAMBIOS',
          'El texto es igual a la versión publicada.',
        );
      }
      const version = (anterior?.version ?? 0) + 1;
      const doc = await m.getRepository(LegalDocument).save(
        m.getRepository(LegalDocument).create({
          type: tipo,
          version,
          contentMd: limpio,
          publishedBy: sesion.usuarioId,
        }),
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'contenido.legal_publicado',
          targetType: 'legal_document',
          targetId: doc.id,
          metadata: { tipo, version },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
      return {
        id: doc.id,
        tipo,
        version,
        publicadoEn: doc.publishedAt,
        contenido: doc.contentMd,
      };
    });
  }

  // ── Preguntas frecuentes ────────────────────────────────────────────────────────────────────────────

  async preguntas(): Promise<PreguntaFrecuente[]> {
    // Consulta directa: el tipo recursivo del JSON de `settings` es demasiado profundo para `findOneBy`.
    const filas = (await this.fuente.query(`SELECT value FROM settings WHERE key = 'faq'`)) as {
      value: PreguntaFrecuente[];
    }[];
    return filas[0]?.value ?? [...PREGUNTAS_INICIALES];
  }

  async guardarPreguntas(
    preguntas: PreguntaFrecuente[],
    sesion: SesionActiva,
    cliente: ContextoCliente,
  ): Promise<PreguntaFrecuente[]> {
    const limpias = preguntas.map((p) => ({
      pregunta: p.pregunta.trim(),
      respuesta: p.respuesta.replace(/\r\n/g, '\n').trim(),
    }));
    await this.fuente.transaction(async (m) => {
      await m.query(
        `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('faq', $1::jsonb, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [JSON.stringify(limpias), sesion.usuarioId],
      );
      await this.auditoria.registrar(
        {
          actorId: sesion.usuarioId,
          actorRole: sesion.rol,
          action: 'contenido.preguntas_guardadas',
          targetType: 'setting',
          targetId: 'faq',
          metadata: { cantidad: limpias.length },
          ip: cliente.ip,
          userAgent: cliente.userAgent ?? null,
        },
        m,
      );
    });
    return limpias;
  }
}
