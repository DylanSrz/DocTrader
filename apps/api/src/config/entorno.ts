import { z } from 'zod';

const llaveBase64De32Bytes = z
  .string()
  .refine((valor) => Buffer.from(valor, 'base64').length === 32, {
    message: 'debe ser una llave de 32 bytes en base64 (openssl rand -base64 32)',
  });

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  AUDIT_HMAC_KEY: llaveBase64De32Bytes,
  /** Cifrado por campo (cédula, segundo factor, enlaces en la bandeja de salida). `docs/SEGURIDAD.md` §4. */
  DATA_ENCRYPTION_KEY: llaveBase64De32Bytes,
  /** HMAC para buscar datos cifrados sin descifrarlos (cédula repetida) y para guardar hashes de enlaces. */
  LOOKUP_HMAC_KEY: llaveBase64De32Bytes,
  /**
   * Secreto compartido con la web. Solo la web (su servidor) habla con la API: sin este secreto, la API no
   * responde. Obligatorio en producción (lo revisa `configurarApp`).
   */
  PROXY_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres').optional(),
  /** Cloudflare Turnstile. Sin secreto, el desafío no se pide (solo en desarrollo, o mientras se crea la cuenta). */
  TURNSTILE_SECRET: z.string().min(1).optional(),
  /** Revisar contraseñas filtradas en Have I Been Pwned (por rango, la contraseña nunca sale del servidor). */
  HIBP_ACTIVO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
  /** Correos: Resend en producción; Mailpit en desarrollo; si no hay ninguno, se escriben en el registro. */
  RESEND_API_KEY: z.string().min(1).optional(),
  MAILPIT_URL: z.url().optional(),
  MAIL_FROM: z.string().default('DocTraderPRO <notificaciones@doctraderpro.com>'),
  MAIL_REPLY_TO: z.email().default('support@doctraderpro.com'),
  /**
   * Precio de BTC para las órdenes: Binance (sin llave) y CoinGecko (plan Demo; la llave es opcional pero da más
   * consultas). `docs/DECISIONES-TECNICAS.md` §2.
   */
  COINGECKO_API_KEY: z.string().min(1).optional(),
  /**
   * Verificación de pagos en Tron: TronGrid (principal) y Tronscan (respaldo). Funcionan sin llave con pocos
   * pagos; con llave (gratis) tienen más consultas. Bitcoin usa mempool.space y Blockstream, sin llave.
   */
  TRONGRID_API_KEY: z.string().min(1).optional(),
  TRONSCAN_API_KEY: z.string().min(1).optional(),
  /**
   * Huellas del control de la prueba (`docs/SEGURIDAD.md` §4.4): una llave propia, distinta de las demás, que no se
   * rota borrando la anterior. Sin ella, las solicitudes de prueba quedan cerradas.
   */
  TRIAL_HMAC_KEY: llaveBase64De32Bytes.optional(),
  /**
   * SMS para verificar el teléfono (Twilio Verify, `docs/DECISIONES-TECNICAS.md` §1). En desarrollo y en pruebas,
   * sin estas variables, el código se escribe en el registro de la API; en producción, sin ellas, no se envían SMS.
   */
  TWILIO_ACCOUNT_SID: z
    .string()
    .regex(/^AC[0-9a-f]{32}$/, 'empieza por AC')
    .optional(),
  TWILIO_AUTH_TOKEN: z.string().min(16).optional(),
  TWILIO_VERIFY_SERVICE_SID: z
    .string()
    .regex(/^VA[0-9a-f]{32}$/, 'empieza por VA')
    .optional(),
  /**
   * Adjuntos de soporte en Cloudflare R2, privado (`docs/DECISIONES-TECNICAS.md` §3). Sin estas variables: en
   * desarrollo y en pruebas se guardan en una carpeta local (`ARCHIVOS_DIR`); en producción no se pueden adjuntar.
   */
  R2_ACCOUNT_ID: z
    .string()
    .regex(/^[0-9a-f]{32}$/, 'es el identificador de la cuenta de Cloudflare (32 caracteres)')
    .optional(),
  R2_ACCESS_KEY_ID: z.string().min(16).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(32).optional(),
  R2_BUCKET: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
      'nombre de depósito de R2 (minúsculas, números y guiones)',
    )
    .optional(),
  /** Carpeta de los adjuntos en desarrollo (sin R2). */
  ARCHIVOS_DIR: z.string().min(1).optional(),
  /** Dirección pública de la API: los enlaces de descarga locales (desarrollo, sin R2) apuntan aquí. */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
});

export type Entorno = z.infer<typeof esquema>;

/**
 * Valida las variables de entorno al arrancar. Si falta o sobra algo, la API no arranca y dice qué corregir,
 * en lugar de fallar más tarde con un error confuso.
 */
export function validarEntorno(variables: Record<string, unknown>): Entorno {
  const resultado = esquema.safeParse(variables);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Variables de entorno no válidas:\n${detalle}`);
  }
  return resultado.data;
}
