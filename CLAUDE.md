# DocTrader

Plataforma web para vender licencias del software de copy trading **Doc Trader Pro AI** (cliente: Argemiro).

- Contexto completo y decisiones: `docs/CONTEXTO.md`
- Información pendiente por recibir: `docs/PENDIENTES.md`

Reglas clave:
- Se vende una **licencia de uso de software**, nunca "servicio de trading" ni rentabilidad garantizada.
- Pagos **manuales y no recurrentes** (periodos prepagados + recordatorios). Precios editables desde el admin.
- Sin devoluciones. Licencia normal y renovación: 6 meses (5 + 1 de obsequio, cupón automático) por USD 499
  o COP 2.000.000. Prueba de 1 mes (USD 50 / COP 200.000) solo bajo solicitud aprobada por el admin; se completa con
  USD 450 / COP 1.800.000 hasta el último día de la prueba (5 meses más, sumados al final de la prueba).
- La conexión de cuentas al copy trading es **manual** (la hace Argemiro); la plataforma gestiona pagos,
  suscripciones, datos de cuenta (credenciales cifradas) y colas "por conectar" / "por desconectar".
- Dos administradores con todos los permisos: Argemiro y el desarrollador (socio con % de ventas).
- Stack: NestJS (API) + Next.js (web) + PostgreSQL/Prisma. Idioma del producto: español.
