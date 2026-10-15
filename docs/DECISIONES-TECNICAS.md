# Decisiones técnicas

> 2026-10-14. Precios consultados ese día en las páginas oficiales de cada proveedor; pueden cambiar. Las cuentas se
> crean con el correo de Dylan y los pagos los cubre Argemiro.

## 1. SMS: Twilio Verify (retirada)

**Retirada el 2026-10-15:** sin licencia de prueba no se verifica el teléfono por SMS; no se usa Twilio. (Se había
elegido Twilio Verify, solo para pedir la prueba.) El número de la sección se conserva para no romper referencias.

## 2. Lectura de la blockchain

**Decisión:** un verificador por red, cada uno con un proveedor principal y uno de respaldo. Todo gratis con el
volumen esperado. Si el principal falla, se usa el de respaldo; si fallan los dos, la orden queda "por verificar" y se
reintenta. Nunca se aprueba sin verificar.

| Red | Principal | Respaldo | Cómo se verifica |
|---|---|---|---|
| **Tron** (USDT TRC20) | TronGrid, con llave gratis | Tronscan API, con llave | `walletsolidity/gettransactioninfobyid`: devuelve el resultado ya consolidado (irreversible) con el evento de transferencia del contrato de USDT |
| **Bitcoin** | mempool.space | Blockstream Esplora (misma API) | `/tx/:txid` para las salidas y `/tx/:txid/status` + altura actual para las confirmaciones |

**Datos:** USDT en Tron es el contrato `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`, con 6 decimales. BTC usa 8 decimales
(satoshis). La dirección BTC de Argemiro es del formato antiguo (empieza por 1); se acepta igual que las nuevas.

**Si algún día vuelve USDC en BNB Smart Chain** (se quitó el 2026-10-14): leer el recibo de la transacción con
NodeReal (plan gratis) y los nodos públicos de BNB Chain de respaldo, no con BscScan, que ya no tiene plan gratis para
esa red. El contrato es `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` y usa **18 decimales**.

**Precio de BTC** (para fijar el monto de la orden): API pública de Binance (`data-api.binance.vision`, par BTCUSDT)
como principal y CoinGecko (plan Demo gratis, 10.000 consultas al mes) como respaldo. Si los dos difieren en más de
1 %, no se crea la orden y se avisa a los admins. Hay que probar desde el servidor que Binance no bloquee la región.

**Detectar pagos sin hash** (si el cliente no lo reporta): TronGrid lista las transferencias TRC20 de una dirección y
mempool.space lista las transacciones de una dirección.

**Direcciones de Binance:** las de cobro son de la cuenta de Binance de Argemiro. La verificación sigue siendo en la
blockchain pública. Más adelante, como segunda confirmación opcional, se puede consultar el historial de depósitos de
Binance con una llave de API **solo de lectura**, limitada a la IP del servidor: confirma que el dinero quedó
acreditado en la cuenta. No es necesario para lanzar.

**Billetera de origen** (se guarda con la orden; era una señal del control de la prueba, retirado el 2026-10-15): en
Tron es el remitente del evento de transferencia. En Bitcoin una transacción puede tener varias entradas; se guardan
todas.

## 3. Archivos: Cloudflare R2

**Decisión:** un depósito **privado** en Cloudflare R2 para los adjuntos de tickets.

| | Cloudflare R2 | Vercel Blob | AWS S3 |
|---|---|---|---|
| Gratis al mes | 10 GB, 1 M escrituras, 10 M lecturas | 1 GB (plan Hobby) | Créditos temporales |
| Almacenamiento | USD 0,015 por GB | USD 0,023 por GB | ~USD 0,023 por GB |
| Descarga | **Gratis** | USD 0,05 por GB | ~USD 0,09 por GB |
| Enlaces firmados | Sí | Sí (desde junio de 2026) | Sí |

R2 sale gratis con el volumen esperado, no cobra las descargas, es compatible con S3 (se usa el SDK de AWS) y queda en
la misma cuenta de Cloudflare que Turnstile.

**Cómo se usa:**
- El archivo pasa primero por la API: se valida y las imágenes se vuelven a codificar. Luego se guarda con un
  nombre aleatorio.
  - El navegador lo sube **directo a la API**, no por la web: las funciones de Vercel no aceptan cuerpos de más de
    4,5 MB. La web pide un permiso con la sesión (una ficha firmada de 30 minutos) y el navegador la manda con el
    archivo a `/archivos/subir`, la única ruta de la API (con la descarga local de desarrollo) que no exige el
    secreto de la web. (2026-10-15, etapa 7.)
  - Con R2 se habla por su API compatible con S3, firmada con `aws4fetch` (unos KB) en vez del SDK de AWS. Las
    imágenes se limpian con `sharp`.
- Para verlo, la API entrega un enlace firmado que vence en 5 minutos, solo si el usuario tiene permiso. La web
  redirige a él (tampoco puede responder más de 4,5 MB).
- Un segundo depósito, separado, guarda la copia semanal cifrada de la base de datos (ver `SEGURIDAD.md`).

## 4. Servicios y costo mensual estimado

| Servicio | Para qué | Plan | Costo aproximado |
|---|---|---|---|
| **Vercel** | Web (Next.js) | Pro: el plan gratis (Hobby) no permite uso comercial | USD 20 al mes |
| **Railway** (o Render) | API, worker, PostgreSQL y Redis | Hobby: USD 5 con USD 5 de uso incluido, más el uso extra | USD 10 a 20 al mes al inicio |
| **Resend** | Correos automáticos | Gratis hasta 3.000 correos al mes; luego Pro | USD 0 a 20 al mes |
| **Cloudflare** | R2 (archivos) y Turnstile (anti-bots) | Gratis con este volumen | USD 0 |
| **Sentry** | Errores | Gratis para un desarrollador | USD 0 |
| **Proveedores de blockchain** | Verificar pagos | Gratis con llave | USD 0 |
| **Hostinger** | Dominio y buzón support@ | Ya pagado | — |

**Total al lanzar: unos USD 35 a 55 al mes**, hasta unos USD 75 si crecen los correos. Los planes de Vercel,
Railway y Resend se confirman al crear las cuentas.

## 5. Myfxbook en la landing

- **Qué enlace se necesita:** el de la página pública de la cuenta de Argemiro, con la forma
  `https://www.myfxbook.com/members/<usuario>/<nombre-del-sistema>/<número>`.
- La cuenta debe estar **pública** y con las dos verificaciones en verde: "Track record verified" (Myfxbook lee el
  historial del broker con la contraseña de inversor) y "Trading privileges verified".
- **Widget:** los de Myfxbook son **imágenes** con un enlace, no iframes. Con el número de la cuenta (el último número
  del enlace), la plataforma arma sola la gráfica de crecimiento con los colores de la marca (fondo negro y línea
  naranja) usando el widget personalizado de Myfxbook. Por eso basta con el enlace.
- Si Argemiro prefiere otro widget, los encuentra en **myfxbook.com/widgets** (o en la pestaña "Widgets" de su
  cuenta) y envía el código que le da la página.
- Las cifras de la landing (ganancia, caída máxima, tiempo auditado) se cargan desde el panel de admin.

Informe de costos para Argemiro: https://claude.ai/code/artifact/53c858bb-d6c6-49f5-b4d6-24418869fe86
