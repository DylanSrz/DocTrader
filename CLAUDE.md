# DocTrader

Plataforma web para vender licencias del software de copy trading **Doc Trader Pro AI** (cliente: Argemiro).

- Contexto completo y decisiones: `docs/CONTEXTO.md`
- Información pendiente por recibir: `docs/PENDIENTES.md`

Reglas clave:
- Se vende una **licencia de uso de software**, nunca "servicio de trading" ni rentabilidad garantizada.
- Pagos **manuales y no recurrentes** (periodos prepagados + recordatorios). Precios editables desde el admin.
- Sin devoluciones. Licencia normal 6 meses (USD 499, incluye 1 mes de obsequio vía cupón). Prueba de 1 mes
  (USD 50) solo bajo solicitud; se completa con USD 450 por 5 meses más.
- La conexión de cuentas al copy trading es **manual** (la hace Argemiro); la plataforma gestiona pagos,
  suscripciones, datos de cuenta (credenciales cifradas) y colas "por conectar" / "por desconectar".
- Dos administradores con todos los permisos: Argemiro y el desarrollador (socio con % de ventas).
- Stack: NestJS (API) + Next.js (web) + PostgreSQL/Prisma. Idioma del producto: español.
