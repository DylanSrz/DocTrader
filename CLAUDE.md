# DocTrader

Plataforma web para vender licencias del software de copy trading **Doc Trader Pro AI** (cliente: Argemiro).

- Contexto completo y decisiones: `docs/CONTEXTO.md`
- Información pendiente por recibir: `docs/PENDIENTES.md`
- Documento de requerimientos formal (RN, RF, RNF, HU, alcance): https://claude.ai/code/artifact/12e017f5-308d-45a5-bf40-89b2d4b6f121

Reglas clave:
- Se vende una **licencia de uso de software**, nunca "servicio de trading" ni rentabilidad garantizada.
- Pagos **manuales y no recurrentes** (periodos prepagados + recordatorios). Precios editables desde el admin.
- Sin devoluciones. Precios en USD; en pesos se cobra el equivalente a la **TRM del día** del pago (todas las licencias).
  Licencia normal y renovación: 6 meses (5 + 1 de obsequio, cupón automático) por USD 499.
  Licencia trimestral: 3 meses por USD 319, sin obsequio. Un trimestral puede pasarse a la normal antes de vencer (días se suman).
  Prueba de 1 mes (USD 50) solo bajo solicitud aprobada por el admin; se completa con USD 450 hasta el último día
  de la prueba (5 meses más, sumados al final de la prueba, sin obsequio).
- Antes de conectar, el cliente sube **un LPOA firmado** (uno por cliente, plantilla de Argemiro) y un admin lo aprueba.
- Broker sugerido: JustMarkets, link de referido https://one.justmarkets.link/a/5vmbn05zda.
- La conexión de cuentas al copy trading es **manual** (la hace Argemiro); la plataforma gestiona pagos,
  suscripciones, datos de cuenta (credenciales cifradas) y colas "por conectar" / "por desconectar".
- Dos administradores con todos los permisos: Argemiro y el desarrollador (socio con % de ventas).
- Stack: NestJS (API) + Next.js (web) + PostgreSQL/Prisma. Idioma del producto: español.
