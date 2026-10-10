# DocTrader

Plataforma web para vender licencias del software de copy trading **Doc Trader Pro AI** (cliente: Argemiro).

- Contexto completo y decisiones: `docs/CONTEXTO.md`
- Información pendiente por recibir: `docs/PENDIENTES.md`
- Documento de requerimientos formal (RN, RF, RNF, HU, alcance): https://claude.ai/code/artifact/12e017f5-308d-45a5-bf40-89b2d4b6f121

Estado: **modo plan**. No escribir código de la aplicación hasta que el usuario lo pida.

Reglas clave:
- Se vende una **licencia de uso de software**, nunca "servicio de trading" ni rentabilidad garantizada.
- **Una licencia por cada cuenta de trading.** Pagos **manuales y no recurrentes** (periodos prepagados + recordatorios).
- Precios en USD, editables desde el admin. Sin devoluciones.
  Trimestral: 3 meses, USD 319, sin obsequio. Semestral: 6 meses (5 + 1 de obsequio, cupón automático), USD 499.
  Un trimestral puede pasarse a semestral antes de vencer (días se suman).
  Prueba de 1 mes (USD 50), solo bajo solicitud aprobada por el admin; se completa **solo a semestral** con USD 450
  hasta el último día de la prueba (5 meses más, sumados al final, sin obsequio).
  Si algún día se cobra en pesos: TRM oficial del día (Superintendencia Financiera) redondeada a 1.000 pesos.
- **Solo cripto** por ahora: USDT (Tron TRC20), USDC (BNB Smart Chain BEP20), BTC (Bitcoin).
  Binance Pay + direcciones de depósito que el admin agrega en el panel.
  Orden de pago válida 1 hora. Pasarela en pesos: fase 2.
- Vencida la licencia: **3 días de gracia** (editable en admin) y luego pasa a "por desconectar".
- **No hay LPOA**: con licencia pagada y datos completos, la cuenta pasa a "por conectar".
- La conexión de cuentas al copy trading es **manual** (la hace Argemiro); la plataforma gestiona pagos,
  licencias, datos de cuenta (contraseñas cifradas) y listas "por conectar" / "por desconectar".
- Dos administradores con todos los permisos: Argemiro y el desarrollador (socio, comisión 10 % del bruto editable desde su perfil,
  liquidada los 15 y 30 de cada mes).
- Registro con nombre, **cédula**, correo y teléfono; una prueba por cliente (controlada por cédula). Soporte por Telegram. Broker sugerido: JustMarkets
  (https://one.justmarkets.link/a/5vmbn05zda).
- Marca: colores del logo de Argemiro; tipografías y estilos los define el desarrollo, con una página de
  referencia. Prioridad: UI/UX excelente.
- Stack: NestJS (API) + Next.js (web) + PostgreSQL con **TypeORM**. Idioma del producto: español.
