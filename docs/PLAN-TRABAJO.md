# Plan de trabajo

> 2026-10-14. Cómo se construye la fase 1 (lanzamiento). Alcance en `CONTEXTO.md` §7; datos y estados en
> `MODELO-DATOS.md`; seguridad en `SEGURIDAD.md`; servicios en `DECISIONES-TECNICAS.md`. Diseño de referencia:
> `design/propuesta-2/` (landing, panel del cliente y panel de admin).

## 1. Cómo se trabaja

- **Repositorio:** monorepo pnpm con `apps/api` (NestJS: API y worker), `apps/web` (Next.js) y `packages/shared`
  (tipos, esquemas de validación y reglas de negocio puras, como el cálculo de fechas y precios).
- **Ramas:** `main` protegida. Cada etapa se hace en ramas cortas que entran por pull request con las pruebas en verde.
- **Hecho** significa: funciona en el entorno de pruebas, tiene sus pruebas automáticas, cumple el diseño de la
  propuesta 2 en celular y escritorio, y deja registro en la auditoría cuando corresponde.
- Al cerrar cada etapa se le muestra a Argemiro en el entorno de pruebas.

## 2. Entornos

| Entorno | Dónde | Datos | Para qué |
|---|---|---|---|
| **Desarrollo** | En el computador, con Docker Compose: PostgreSQL, Redis, Mailpit (correos de prueba) y Adminer | Ficticios, cargados con un script | Programar |
| **Pruebas** | Vercel (vista previa de cada pull request) y un entorno de Railway con su propia base de datos | Ficticios | Revisar cada etapa y mostrársela a Argemiro |
| **Producción** | Vercel + Railway, en doctraderpro.com y api.doctraderpro.com | Reales | Clientes |

- Cada entorno tiene sus propias llaves y secretos. Nunca se copian datos reales de producción a otro entorno.
- En desarrollo y pruebas, los pagos se verifican en las **redes de prueba** de Tron (Nile) y Bitcoin (testnet o
  signet), y Twilio usa números de prueba.

## 3. Pruebas automáticas

| Tipo | Qué cubre | Herramienta |
|---|---|---|
| **Reglas de negocio** | Fechas de licencia (meses de calendario, obsequio, completar la prueba, renovar en gracia), precios y diferencias, comisión, normalización de correo, teléfono y cuenta, huellas HMAC | Vitest en `packages/shared` |
| **API** | Permisos (un cliente no ve lo de otro; un cliente no entra a rutas de admin), registro e ingreso, pagos (hash repetido, aprobar dos veces al mismo tiempo, monto incompleto), control de la prueba, cifrado | Jest + Supertest contra una base de datos de prueba |
| **Verificadores de blockchain** | Respuestas grabadas de TronGrid y mempool.space (pago correcto, monto incompleto, otra dirección, sin confirmaciones, proveedor caído) | Jest con respuestas grabadas |
| **De punta a punta** | Registro → agregar cuenta → orden → reportar hash → aprobar → por conectar → conectada; solicitud de prueba → aprobación → completarla; ticket de ida y vuelta | Playwright |
| **Accesibilidad y diseño** | Sin desbordes a 320, 390, 768, 1024 y 1440 px; foco visible; contraste | Playwright + axe |

**Integración continua** (GitHub Actions) en cada pull request: lint, revisión de tipos, pruebas, búsqueda de
secretos (gitleaks), análisis de código (CodeQL) y revisión de dependencias (Dependabot).

## 4. Etapas

Cada etapa deja algo que se puede usar y probar. El orden respeta las dependencias: no hay pagos sin cuentas, ni
prueba sin pagos.

### Etapa 0 — Base del proyecto
- Monorepo, Docker Compose de desarrollo, integración continua y despliegue a pruebas.
- Sistema de diseño de la propuesta 2 en Tailwind: colores, Inter, píldoras, triángulos y componentes base.
- Migraciones de TypeORM, datos iniciales (planes, ajustes, direcciones de depósito, los dos admins) y auditoría.
- **Hecho cuando:** la web y la API vacías se despliegan solas en pruebas y las pruebas corren en cada pull request.

### Etapa 1 — Cuentas y acceso
- Registro con nombre, cédula, correo y teléfono, casillas de términos, datos y riesgo, y Turnstile.
- Verificación del correo, ingreso, recuperar contraseña, sesiones en Redis y aviso de dispositivo nuevo.
- Segundo factor obligatorio para admins y confirmación reciente para acciones delicadas.
- Roles, límites de velocidad, encabezados de seguridad.
- **Hecho cuando:** un cliente se registra y entra; un admin entra con segundo factor; las pruebas de permisos pasan.

### Etapa 2 — Página pública
- Landing de la propuesta 2 con planes y precios desde la base de datos, preguntas frecuentes, Myfxbook y broker.
- Páginas legales desde `legal_documents` (textos de `docs/legal/`).
- **Hecho cuando:** la landing se ve como el prototipo, carga rápido en celular y los textos legales se pueden
  actualizar sin tocar código.

### Etapa 3 — Cuentas de trading, licencias y órdenes
- Agregar cuentas con contraseñas cifradas y la regla de una cuenta por cliente.
- Crear órdenes de compra, renovación y cambio de plan, con precio de BTC fijo por una hora y cuenta regresiva.
- Panel del cliente: mis cuentas con el calendario de triángulos, pagos e historial.
- **Hecho cuando:** un cliente crea una orden, ve la dirección y el monto exactos, y la orden expira sola a la hora.

### Etapa 4 — Verificación y aprobación de pagos
- Worker con BullMQ: verificadores de Tron y Bitcoin con proveedor de respaldo, confirmaciones y reintentos.
- Vista de pagos del admin con los cinco chequeos, aprobar, rechazar con motivo y aprobación automática (apagada).
- Al aprobar: periodo, licencia activa, comisión del socio y cuenta "por conectar".
- **Hecho cuando:** un pago real en la red de prueba se verifica solo y, al aprobarlo, la licencia queda activa con
  las fechas correctas.

### Etapa 5 — Operación del admin
- Hoy, listas por conectar y por desconectar, ver contraseñas con segundo factor, ficha del cliente (capital, riesgo,
  notas, extender días, suspender).
- Licencias con filtros y exportar a CSV; ajustes (precios, gracia, confirmaciones, enlaces, cifras de Myfxbook,
  preguntas frecuentes); direcciones de depósito con la espera de 24 horas.
- **Hecho cuando:** Argemiro puede operar un día completo desde el panel sin ayuda.

### Etapa 6 — Licencia de prueba
- Verificación del teléfono por SMS (Twilio Verify) con límites y protección contra fraude.
- Solicitud con bloqueos y señales, registro de huellas, aprobación del admin y orden de USD 50.
- Completar la prueba pagando la diferencia; bloqueo de cambios de la cuenta durante la prueba.
- **Hecho cuando:** las pruebas automáticas confirman que la misma cédula, cuenta, correo o teléfono no pueden pedir
  una segunda prueba, aunque se registren de nuevo.

### Etapa 7 — Soporte
- Tickets del cliente con adjuntos en R2, bandeja del admin con filtros, asignación, prioridad, notas internas y
  respuestas guardadas; cierre automático.
- **Hecho cuando:** un ticket va y vuelve entre cliente y admin con adjuntos y correos.

### Etapa 8 — Automatizaciones y socio
- Correos con Resend (plantillas con la marca), recordatorios, gracia, vencimiento y alertas a los admins.
- Perfil del socio: % de comisión, liquidaciones del 15 y fin de mes e historial.
- Trabajos de borrado según la política de datos.
- **Hecho cuando:** una licencia de prueba recorre todo su ciclo en pruebas (con fechas aceleradas) y llegan todos
  los correos, una sola vez cada uno.

### Etapa 9 — Endurecimiento y lanzamiento
- Revisión de seguridad completa contra `SEGURIDAD.md`, Sentry, monitor de disponibilidad, copias de seguridad y una
  restauración de prueba.
- Dominio y correo: DNS en Hostinger, Resend verificado, DMARC.
- Lista de lanzamiento (§5) y lanzamiento suave con pocos clientes antes de anunciarlo.

## 5. Lista para el día del lanzamiento

**Legal y contenido**
- [ ] Datos del responsable completos en la política de datos (NIT o cédula, dirección y teléfono).
- [ ] Términos, política y aviso de riesgo publicados (idealmente revisados por un abogado).
- [ ] Cifras de Myfxbook al día; caída máxima y tiempo auditado solo si el historial ya está completo.

**Dinero**
- [ ] Direcciones de USDT (Tron) y BTC comprobadas con un pago real pequeño a cada una, verificado por la plataforma.
- [ ] Cuenta de Binance con segundo factor fuerte, código antiphishing y lista blanca de retiros.
- [ ] Precios, días de gracia y confirmaciones revisados en el panel.

**Cuentas y seguridad**
- [ ] Los dos admins entran con segundo factor y guardaron sus códigos de recuperación.
- [ ] Segundo factor en Vercel, Railway, Resend, Twilio, Cloudflare, Sentry, GitHub y Hostinger.
- [ ] Llaves de cifrado de producción guardadas en el gestor de contraseñas compartido.
- [ ] Copia de seguridad restaurada con éxito al menos una vez.
- [ ] Permisos geográficos de Twilio solo para los países donde se vende.

**Funcionamiento**
- [ ] Recorrido completo con una cuenta real: registro → compra → pago → aprobación → conexión → correo.
- [ ] Correos llegando a la bandeja de entrada (no a spam) en Gmail y Outlook.
- [ ] Monitor de disponibilidad y alertas activos.
- [ ] Revisión en celular (iPhone y Android) y en escritorio.

## 6. Después del lanzamiento

- Binance Pay Merchant cuando Binance lo apruebe.
- Segunda verificación con el historial de depósitos de Binance (llave solo de lectura).
- Fase 2 (`CONTEXTO.md` §7): pagos en pesos, referidos, cupones, avisos por Telegram o WhatsApp y versión en inglés.
