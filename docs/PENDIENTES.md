# Pendientes — información por recibir

> Actualizado: 2026-10-22. Lo resuelto está en `CONTEXTO.md`; aquí queda solo lo abierto.

## ⏳ En espera

- [ ] **Aprobación de Binance Pay Merchant** (Argemiro ya la solicitó). Cuando llegue: llaves de API
      (primero en modo prueba) para activar la confirmación automática. Mientras tanto: depósito directo
      con aprobación manual.

## 🟢 Marca y contenido

- [x] **Logo** recibido (`design/marca/logo-original.png`).
- [x] **Página de referencia:** https://denmu.com/
- [x] **Elección de propuesta de diseño:** Argemiro eligió la propuesta 2 (2026-10-12).
- [x] **Correo oficial:** support@doctraderpro.com (2026-10-13).
- [x] **Cuenta auditada del otro broker** (2026-10-23): https://www.myfxbook.com/members/Dr_arge/doctrader-pro-academy/11792099.
      Reemplaza a la de JustMarkets en la landing y en la presentación. Cifras de la captura del 2026-10-23: ganancia
      +79,98 % (absoluta +5,82 %), 4,17 % mensual, caída máxima 30,31 %, desde el 18 de agosto de 2025. En producción
      se cargan desde el admin (Ajustes → Myfxbook); el valor inicial está en `MYFXBOOK_INICIAL` (shared). La caída
      máxima **no se muestra** (decisión del 2026-10-23): la landing enseña la ganancia y el tiempo auditado.
      Al tomar la captura, la equity venía cayendo por operaciones abiertas en pérdida: revisar las cifras cada tanto.
- [x] **Myfxbook de JustMarkets** (2026-10-14, ya no se muestra desde el 2026-10-23):
      https://www.myfxbook.com/members/Dr_arge/doctrader-pro-ia-system/12253459 (cuenta 12253459, real en centavos
      USC, MT4). Pública, con historial público y transacciones abiertas, órdenes y SL/TP privados.
- [ ] **Historial archivado en Myfxbook** (2026-10-14). La cuenta (login MT4 **450197102**) empezó el **1 de septiembre
      de 2025** (corregido el 2026-10-23 con el historial de JustMarkets; antes se creía febrero de 2025), pero JustMarkets archivó
      el historial viejo ("PnL.Arch") para ahorrar espacio. Por eso Myfxbook muestra:
      - un depósito con fecha 01/02/2000, que hace que la gráfica arranque en el año 2000 y que los promedios salgan
        diminutos (0,38 % mensual, 0,01 % diario);
      - operaciones resumen con precio 0 entre abril y septiembre de 2026, en lugar de las operaciones reales;
      - operaciones verificables una por una solo desde el 2 de octubre de 2026.
      Consecuencias: el tiempo auditado no se puede publicar y la **caída máxima (11,59 %) probablemente se queda corta**,
      porque los resúmenes esconden las caídas dentro de cada periodo. La ganancia (+246,68 %) también sale de esos
      resúmenes.
      **Respuesta de JustMarkets (2026-10-23):** mandaron el historial completo en Excel (desde la creación de la
      cuenta hasta el 21 de octubre de 2026: 15.593 operaciones con sus precios reales, 15 depósitos y 8 retiros). No
      dicen nada de restaurarlo en el servidor, así que Myfxbook seguirá igual: lee el historial del broker, no el
      Excel.
      **Cálculo propio con ese Excel** (solo operaciones cerradas; **no es auditado y no se publica**):
      - desde octubre de 2025 (13 meses): +65,7 % compuesto (unos 3,96 % al mes), todos los meses positivos (el
        peor, mayo de 2026, +0,94 %) y caída máxima del balance cerrado de 10,7 % (enero de 2026);
      - 70,4 % de operaciones ganadoras, todas en pares de divisas mayores;
      - septiembre de 2025 distorsiona las cifras (depósitos y retiros grandes con un balance de USD 61): contándolo
        salen +304 % y 36 % de caída, que no son representativas;
      - sin la flotante (el Excel no la trae), la caída real con la equity fue mayor;
      - hubo movimientos de capital muy grandes (por ejemplo, +USD 9.100 en enero y −USD 19.630 en febrero de 2026).
      Qué sigue (Argemiro): pedir al soporte de Myfxbook que fije la fecha de inicio en septiembre de 2025 o recalcule
      la cuenta (borrador del mensaje entregado a Dylan el 2026-10-23).
      Desde el 2026-10-23, la landing y la presentación muestran la cuenta del otro broker (ver arriba), con la
      ganancia y el tiempo auditado; esta queda como cuenta anterior.
- [ ] Fotos y videos (¿video explicativo para el inicio?).
- [x] **Dominio:** doctraderpro.com, comprado en Hostinger, donde se maneja el DNS (2026-10-13).
- [x] **Buzón del dominio:** support@doctraderpro.com, que es también el correo oficial (2026-10-13).
- [x] **Textos del hero:** escritos por el desarrollo (2026-10-14); se ajustan si Argemiro pide cambios.
- [ ] Perfil de Argemiro (opcional para el lanzamiento).
- [x] **Preguntas frecuentes:** se lanzan con las de la landing; Argemiro las edita desde su panel.
- [x] **Widget de Myfxbook:** no hace falta enviarlo; la plataforma arma la gráfica con el número de la cuenta del
      enlace (ver `docs/DECISIONES-TECNICAS.md`, §5).
- [x] **Redes:** Telegram https://t.me/+cdmWH_xLubdhMDhh · Instagram https://www.instagram.com/doctraderproiasystem/

## 🧪 Por probar en producción

- [x] **Un pago real de punta a punta** (etapa 4; probado el 2026-10-22 en USDT y BTC, todo bien): con una cuenta de cliente de prueba, crear una orden mensual,
      enviar el monto exacto en USDT (Tron) a la dirección de la orden, reportar el hash y ver que en "Pagos" del
      admin queda **verificado** a los pocos minutos (20 confirmaciones). Aprobarlo y revisar que la licencia quede
      activa por un mes. El dinero llega a la cuenta de Binance de cobro.

- [x] **Un día de operación desde el panel** (etapa 5; probado el 2026-10-22 con el recorrido completo): con el pago anterior aprobado, ir a "Cuentas", ver las
      contraseñas (pide el código de la app), conectar la cuenta en Social Trader Tools, fijar capital y riesgo y
      "Marcar como conectada". El cliente debe recibir el correo y ver el capital y el riesgo en su panel.
- [ ] **Direcciones de depósito** (etapa 5): agregar desde "Ajustes" una dirección de USDT (Tron) que sea de
      ustedes, revisar que a los dos admins les llegue el correo con la dirección completa y cancelarla. Mientras
      está en espera, ninguna orden la usa.

- [ ] **Un ticket de ida y vuelta** (etapa 7; el 2026-10-16 ya se probó en `www` crear un ticket con adjunto): con un cliente, abrir un ticket en "Soporte" con una captura; en el
      admin, dejar una nota interna, responder con una respuesta guardada y asignarlo. Al cliente le debe llegar el
      correo con la respuesta; después, marcarlo resuelto y escribir otra vez para reabrirlo (llega el correo a los
      admins). Con R2 listo, descargar la captura desde los dos lados.
- [x] **Los correos del ciclo de la licencia** (etapa 8; los del pago real llegaron el 2026-10-22; los recordatorios llegan con las fechas reales): con el pago real de arriba, revisar que llegue la
      bienvenida al confirmar el correo y, a los admins, "pago verificado por aprobar" y "venta". Los recordatorios
      (7, 3 y 1 día), "tu licencia venció" y "desconectaremos la cuenta" llegan solos con las fechas reales; se
      probaron con fechas aceleradas.
- [x] **Socio** (etapa 8): el 16 de octubre el worker liquidó la quincena del 1 al 15 (1 venta, comisión USD 24).
      Falta solo mirarla en "Socio" y confirmar que llegó el correo a los dos admins.

## ❓ Por confirmar con Argemiro

- [x] **Pagos en USDT "por confirmar"** (2026-10-18; confirmado el 2026-10-22: se mantiene): con el precio exacto, si otro cliente tenía una orden abierta
      por el mismo monto cuando llegó el pago, el pago no se aprueba solo: hay que pedirle al cliente la captura del
      envío y usar "Aprobar de todos modos". Con pocos clientes pasará poco; si molesta, se puede volver a los
      centavos de diferencia.
- [ ] **Documentos de otros países** (2026-10-18): se admiten Colombia, Argentina, México, Estados Unidos, Reino Unido
      y 22 países más con pasaporte o documento nacional. ¿Falta algún país o documento?

- [x] **Aceptar de nuevo los textos legales** (2026-10-15): no hace falta. Los clientes de hoy son de prueba y, antes
      de salir a producción, se limpia la base de datos (todo menos los admins): todos los clientes se registran de
      nuevo con los textos vigentes.
- [x] **Eliminar la cuenta de un cliente que lo pida** (2026-10-15): sí, y lo hace un admin desde el panel. Construido
      en la etapa 9: "Eliminar cliente" en la ficha de Licencias (con el código de la app).
- [x] **Cambiar el número de una cuenta con licencia vigente** (2026-10-15): se pide por ticket. Construido: el
      cliente ya no puede cambiar broker, servidor ni número con la licencia vigente (le sale el enlace al ticket) y
      el admin lo cambia en la ficha de Licencias → "Cambiar broker, servidor o número", con su código.
- [ ] **Renovar a un plan más corto** (etapa 3): hoy un cliente con semestral puede renovar con mensual
      (se cobra el plan elegido y los días se suman al vencimiento, igual que una renovación). Si Argemiro
      prefiere que solo se pueda renovar al mismo plan o a uno más largo, es un cambio pequeño.

## ⚖️ Legal

- [x] **Titular:** DocTraderPRO, Barranquilla, Colombia.
- [ ] **Datos que la ley pide del responsable** para la política de datos: NIT o cédula de quien responde por
      DocTraderPRO, dirección física y teléfono (quedaron entre corchetes en los textos). Si DocTraderPRO no está
      registrada como empresa, el responsable legal es la persona natural que la representa.
- [x] Borradores escritos (2026-10-14) en `docs/legal/`: términos de la licencia, política de datos y aviso de riesgo.
- [x] Revisión de un abogado: Argemiro la hizo y está de acuerdo con los términos en su totalidad (2026-10-22).
- [x] **Riesgo aceptado (2026-10-22):** los referidos de dos niveles (15 % + 5 %) pueden encuadrar en la Ley 1700 de
      2013 (comercialización en red). Argemiro decidió publicarlos así.

## 🔧 Accesos técnicos (cuando empecemos)

- [x] **Titular de las cuentas de servicio:** se crean con el correo de Dylan; los pagos los cubre Argemiro.
- [x] Vercel (web) y Railway (API, worker, PostgreSQL y Redis) creados y funcionando (2026-10-14).
- [x] **Resend** (2026-10-15): dominio doctraderpro.com verificado y `RESEND_API_KEY` en el worker de Railway.
- [x] **Cloudflare Turnstile** (2026-10-15): llaves en Vercel y en la API.
- [ ] **Pagos desde Binance sin hash (2026-10-16):** construido el reporte con el número de transferencia interna y
      su verificación automática. Para que sea automática:
  - [x] Argemiro crea en Binance (Perfil → Gestión de API) una llave **solo de lectura** ("Enable Reading"; sin
        operar ni retirar). Se ponen `BINANCE_API_KEY` y `BINANCE_API_SECRET` en el worker de Railway, nunca en el chat. Puestas el 2026-10-16.
  - [x] Worker movido a Europa (Amsterdam) el 2026-10-16: Binance no responde desde EE. UU.
  - [ ] Registrar a mano el pago de prueba DTP-000001 (Pagos → Órdenes expiradas → Registrar pago).
- [ ] **CoinGecko (opcional):** el precio de BTC sale de Binance y se compara con CoinGecko. Funciona sin llave; con
      una llave gratis del plan Demo (`COINGECKO_API_KEY` en la API de Railway) hay más consultas al mes.
- [x] **Cloudflare R2 (adjuntos de soporte, etapa 7, 2026-10-15):** en Cloudflare → R2, crear un depósito privado
      `doctrader-adjuntos` (sin acceso público ni dominio) y un token de API de R2 con permiso "Object Read & Write"
      solo para ese depósito. Poner `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET` en la
      API **y** en el worker de Railway (el worker borra los adjuntos sin usar). No hace falta CORS en R2: el
      navegador sube a la API y descarga con un enlace firmado. Sin estas variables, los tickets funcionan sin
      adjuntos. `WEB_ORIGIN` de la API debe ser la dirección exacta de la web (la subida es directa a la API).
- [x] **Sentry (etapa 9, 2026-10-15):** organización `dylansrz`, proyectos `doctrader-api` (API y worker) y
      `doctrader-web`. `SENTRY_DSN` ya está en la API y el worker de Railway (empieza a reportar con el próximo
      despliegue que traiga el código de la etapa 9).
- [x] **Monitor de disponibilidad (etapa 9, 2026-10-16):** UptimeRobot revisa cada 5 minutos `/salud` de la API
      (palabra `"estado":"ok"`) y la web, con alerta por correo a los dos admins. Al pasar a `doctraderpro.com` y
      `api.doctraderpro.com`, cambiar las dos direcciones en UptimeRobot.
- [x] **Copias de seguridad (etapa 9, 2026-10-16):** copia **diaria** propia (`.github/workflows/copia-de-seguridad.yml`,
      3:17 a. m. de Colombia) en el depósito de R2 `doctrader-copias`, cifrada y guardada 30 días. La primera corrió
      el 2026-10-16 y la restauración de prueba pasó (11 migraciones, 2 admins, 3 textos legales). El plan Hobby de
      Railway no permite programar copias del volumen; pasar a Pro (USD 20/mes) es opcional.
  - [x] Sentry en Vercel (`SENTRY_DSN` de `doctrader-web`), 2026-10-16.
- [x] **Correo del dominio (2026-10-15):** Resend tiene `doctraderpro.com` verificado (región sa-east-1); DKIM
      (`resend._domainkey`), SPF y MX de rebote en `send.` están publicados; DMARC existe con `p=none`.
  - [ ] Tras dos semanas sin problemas en los reportes, subir DMARC en Hostinger a
        `v=DMARC1; p=quarantine; rua=mailto:support@doctraderpro.com` (empezar en `none` es lo correcto).
- [ ] **Base de datos con permisos separados (etapa 9, `SEGURIDAD.md` §12):** hoy la API usa el usuario dueño de las
      tablas. Lo ideal es un usuario sin permisos de administrador para la API y el worker, y el dueño solo para las
      migraciones. Se puede hacer después del lanzamiento.
- [x] **Dominio propio (2026-10-16):** la web vive en `https://www.doctraderpro.com` (`doctraderpro.com` redirige
      ahí, 308) y la API en `https://api.doctraderpro.com`. DNS en Hostinger con los registros que recomienda Vercel
      (A 216.198.79.1 y CNAME de `www`) y el CNAME de `api` a Railway; el correo de Hostinger y Resend no se tocaron.
      `WEB_ORIGIN` = `https://www.doctraderpro.com` en la API y el worker; `API_URL` de Vercel apunta al dominio nuevo y
      Turnstile ya lo acepta.
  - [ ] UptimeRobot: cambiar las dos direcciones a `https://api.doctraderpro.com/salud` y
        `https://www.doctraderpro.com`.
- [x] **Direcciones de depósito** (2026-10-14; solo dos redes): USDT TRC20 `TLNeQNuQ9tsZweb8cvZaghNpJkX3KE7G4x` y BTC `1H8xfingRtsTvhnf4PosyhXvacXdGVWea1`.
      Desde el 2026-10-16 la pantalla de pago muestra su código QR (generado con la dirección de la orden; coincide
      con los QR de Binance que envió Argemiro).
- [x] Correo de admin de Dylan: dylansrz96@gmail.com.
- [x] Correo de admin de Argemiro: doctraderproiasystem@gmail.com (2026-10-15; antes se registró por error doctraderpro@gmail.com, que la semilla retira).
- [x] Segundo factor en las cuentas de servicio (2026-10-16). Falta el gestor de contraseñas compartido con Argemiro (ver `docs/SEGURIDAD.md`).

## ✅ Resuelto (resumen)

- **2026-10-22:** referidos de dos niveles: 15 % directo y 5 % de segunda línea. Nueva versión de los términos sin
  correo masivo (los clientes actuales son de prueba).
- **2026-10-15:** se retira la licencia trimestral, la semestral pasa a 6 meses sin obsequio y el nombre del dueño
  no aparece en la plataforma (va "DocTrader Pro").
- **2026-10-15:** se quita por completo la licencia de prueba (y con ella la verificación del teléfono por SMS): ya
  no hacen falta Twilio ni `TRIAL_HMAC_KEY`. Si llegaron a ponerse en Railway, se pueden borrar `TRIAL_HMAC_KEY` y
  las `TWILIO_*`.

Stack NestJS + Next.js + PostgreSQL/TypeORM · Docker solo en desarrollo · comisión 10 % del valor bruto, editable desde el perfil del
socio, liquidada los 15 y 30 de cada mes ·
licencias mensual USD 120 y semestral USD 499 (6 meses; la trimestral y el mes de obsequio se quitaron el 2026-10-15) · mensual → semestral antes de vencer (se
paga el plan nuevo; los días se suman) · sin licencia de prueba (se quitó el 2026-10-15) ·
TRM oficial redondeada a 1.000 pesos · sin devoluciones · pasarela COP en fase 2 · Binance Pay +
direcciones de depósito configurables · solo cripto: USDT TRC20 y BTC · orden válida 1 hora · 3 días de gracia
(editable) · una licencia por cuenta de trading · sin LPOA · registro con nombre, cédula, correo y teléfono ·
tickets de soporte en la plataforma ·
verificación automática de pagos en blockchain · soporte por tickets y Telegram · dominio doctraderpro.com · correo oficial support@doctraderpro.com · propuesta de diseño 2 · servicio de copy: Social Trader Tools · JustMarkets único broker sugerido · tipografías y estilos los define el desarrollo.
