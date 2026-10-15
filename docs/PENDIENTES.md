# Pendientes — información por recibir

> Actualizado: 2026-10-15. Lo resuelto está en `CONTEXTO.md`; aquí queda solo lo abierto.

## ⏳ En espera

- [ ] **Aprobación de Binance Pay Merchant** (Argemiro ya la solicitó). Cuando llegue: llaves de API
      (primero en modo prueba) para activar la confirmación automática. Mientras tanto: depósito directo
      con aprobación manual.

## 🟢 Marca y contenido

- [x] **Logo** recibido (`design/marca/logo-original.png`).
- [x] **Página de referencia:** https://denmu.com/
- [x] **Elección de propuesta de diseño:** Argemiro eligió la propuesta 2 (2026-10-12).
- [x] **Correo oficial:** support@doctraderpro.com (2026-10-13).
- [x] **Myfxbook de Argemiro** (2026-10-14): https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459
      (cuenta 12253459, JustMarkets, real en centavos USC, MT4). Pública, con historial público y transacciones abiertas,
      órdenes y SL/TP privados. Ya está en la landing.
- [ ] **Historial archivado en Myfxbook** (2026-10-14). La cuenta empezó en **febrero de 2025**, pero JustMarkets archivó
      el historial viejo ("PnL.Arch") para ahorrar espacio. Por eso Myfxbook muestra:
      - un depósito con fecha 01/02/2000, que hace que la gráfica arranque en el año 2000 y que los promedios salgan
        diminutos (0,38 % mensual, 0,01 % diario);
      - operaciones resumen con precio 0 entre abril y septiembre de 2026, en lugar de las operaciones reales;
      - operaciones verificables una por una solo desde el 2 de octubre de 2026.
      Consecuencias: el tiempo auditado no se puede publicar y la **caída máxima (11,59 %) probablemente se queda corta**,
      porque los resúmenes esconden las caídas dentro de cada periodo. La ganancia (+246,68 %) también sale de esos
      resúmenes.
      Qué hacer (Argemiro): pedir a JustMarkets el estado de cuenta completo desde febrero de 2025 y si pueden
      restaurar el historial; preguntar al soporte de Myfxbook si pueden recalcular la cuenta o fijar su fecha de inicio.
      Mientras tanto, la landing solo muestra la ganancia: la caída máxima se quitó (2026-10-14) y el tiempo auditado y
      el widget de la gráfica esperan a que el historial esté completo.
- [ ] Fotos y videos (¿video explicativo para el inicio?).
- [x] **Dominio:** doctraderpro.com, comprado en Hostinger, donde se maneja el DNS (2026-10-13).
- [x] **Buzón del dominio:** support@doctraderpro.com, que es también el correo oficial (2026-10-13).
- [x] **Textos del hero:** escritos por el desarrollo (2026-10-14); se ajustan si Argemiro pide cambios.
- [ ] Perfil de Argemiro (opcional para el lanzamiento).
- [x] **Preguntas frecuentes:** se lanzan con las de la landing; Argemiro las edita desde su panel.
- [x] **Widget de Myfxbook:** no hace falta enviarlo; la plataforma arma la gráfica con el número de la cuenta del
      enlace (ver `docs/DECISIONES-TECNICAS.md`, §5).
- [x] **Redes:** Telegram https://t.me/+cdmWH_xLubdhMDhh · Instagram https://www.instagram.com/doctraderproiasystem/

## ❓ Por confirmar con Argemiro

- [ ] **Renovar a un plan más corto** (etapa 3): hoy un cliente con semestral puede renovar con mensual
      (se cobra el plan elegido y los días se suman al vencimiento, igual que una renovación). Si Argemiro
      prefiere que solo se pueda renovar al mismo plan o a uno más largo, es un cambio pequeño.

## ⚖️ Legal

- [x] **Titular:** DocTraderPRO, Barranquilla, Colombia.
- [ ] **Datos que la ley pide del responsable** para la política de datos: NIT o cédula de quien responde por
      DocTraderPRO, dirección física y teléfono (quedaron entre corchetes en los textos). Si DocTraderPRO no está
      registrada como empresa, el responsable legal es la persona natural que la representa.
- [x] Borradores escritos (2026-10-14) en `docs/legal/`: términos de la licencia, política de datos y aviso de riesgo.
- [ ] Revisión de un abogado antes de publicar (recomendada).

## 🔧 Accesos técnicos (cuando empecemos)

- [x] **Titular de las cuentas de servicio:** se crean con el correo de Dylan; los pagos los cubre Argemiro.
- [x] Vercel (web) y Railway (API, worker, PostgreSQL y Redis) creados y funcionando (2026-10-14).
- [x] **Resend** (2026-10-15): dominio doctraderpro.com verificado y `RESEND_API_KEY` en el worker de Railway.
- [x] **Cloudflare Turnstile** (2026-10-15): llaves en Vercel y en la API.
- [ ] **CoinGecko (opcional):** el precio de BTC sale de Binance y se compara con CoinGecko. Funciona sin llave; con
      una llave gratis del plan Demo (`COINGECKO_API_KEY` en la API de Railway) hay más consultas al mes.
- [ ] Crear cuando se necesiten: Twilio (SMS, etapa 6), Cloudflare R2 (archivos, etapa 7), Sentry (errores).
      Ver `docs/DECISIONES-TECNICAS.md`.
- [ ] Acceso al DNS de doctraderpro.com en Hostinger para apuntar la web (Vercel) y `api.` (Railway o Render).
- [x] **Direcciones de depósito** (2026-10-14; solo dos redes): USDT TRC20 `TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x` y BTC `1H8xfingRtsTvhnf4PosyhXvacXdGVWea1`.
- [x] Correo de admin de Dylan: dylansrz96@gmail.com.
- [x] Correo de admin de Argemiro: doctraderproiasystem@gmail.com (2026-10-15; antes se registró por error doctraderpro@gmail.com, que la semilla retira).
- [ ] Segundo factor y gestor de contraseñas compartido para las cuentas de servicio (ver `docs/SEGURIDAD.md`).

## ✅ Resuelto (resumen)

- **2026-10-15:** se retira la licencia trimestral, la semestral pasa a 6 meses sin obsequio y el nombre del dueño
  no aparece en la plataforma (va "DocTrader Pro").

Stack NestJS + Next.js + PostgreSQL/TypeORM · Docker solo en desarrollo · comisión 10 % del valor bruto, editable desde el perfil del
socio, liquidada los 15 y 30 de cada mes ·
licencias mensual USD 120 y semestral USD 499 (6 meses; la trimestral y el mes de obsequio se quitaron el 2026-10-15), prueba de 15 días USD 50 que se completa pagando la diferencia (la licencia cuenta desde el inicio de la prueba) ·
la landing invita a solicitar la prueba · teléfono verificado por SMS para pedir la prueba ·
TRM oficial redondeada a 1.000 pesos · sin devoluciones · pasarela COP en fase 2 · Binance Pay +
direcciones de depósito configurables · solo cripto: USDT TRC20 y BTC · orden válida 1 hora · 3 días de gracia
(editable) · una licencia por cuenta de trading · sin LPOA · registro con nombre, cédula, correo y teléfono ·
una prueba por cliente y por cuenta de trading, con control antiabuso · tickets de soporte en la plataforma ·
verificación automática de pagos en blockchain · soporte por tickets y Telegram · dominio doctraderpro.com · correo oficial support@doctraderpro.com · propuesta de diseño 2 · servicio de copy: Social Trader Tools · JustMarkets único broker sugerido · tipografías y estilos los define el desarrollo.
