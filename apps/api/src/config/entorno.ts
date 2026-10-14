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
