# Pendientes — información por recibir

> Para resolver en la reunión con Argemiro. Marcar con `[x]` a medida que se reciba.

## 🔴 Bloquean el inicio del desarrollo

- [ ] **Confirmar tecnología del frontend.** NestJS es un framework de *backend* (API). Para la parte
      visual se propone **Next.js** (React). ¿Se confirma NestJS (API) + Next.js (web)?
      ¿O la intención era Next.js? (los nombres se parecen).
- [ ] **% de comisión del socio desarrollador:**
  - [ ] Porcentaje acordado.
  - [ ] ¿Sobre el valor bruto o neto (después de comisiones de pasarela/Binance)?
  - [ ] ¿Cada cuánto se liquida (mensual, por venta…)? ¿Desde qué fecha aplica?
  - [ ] ¿Aplica también a ventas manuales o fuera de la página?

## 🟠 Pagos

- [ ] **Pasarela en pesos (COP):** ¿cuál usará? (Wompi, ePayco, Mercado Pago, PayU).
      Argemiro debe **confirmar con la pasarela que acepta el negocio** (venta de licencia de software
      relacionado con trading; suelen catalogarlo como alto riesgo). Necesitaremos llaves de prueba (sandbox).
- [ ] **Binance Pay Merchant:** verificar si Argemiro puede abrir cuenta de comerciante
      (Binance Pay Merchant requiere aprobación). Si no, se usa solo depósito directo + aprobación manual.
- [ ] **Direcciones de depósito** de Binance para: USDT-TRC20, USDT-BEP20, BTC (y ETH/USDC si se incluyen).
- [ ] Decidir si se incluyen **ETH y USDC** (y en qué red).
- [ ] ¿Precio en cripto fijo en USD (500 USDT) y BTC calculado al cambio del momento? (propuesto: sí).
- [ ] ¿Cuánto tiempo es válida una orden de pago antes de expirar? (propuesto: 60 minutos para cripto).
- [ ] **Política de reembolsos:** ¿hay reembolso? ¿En qué casos y plazos?
- [ ] ¿Habrá periodo de prueba o descuento de lanzamiento?

## 🟡 Operación y cuentas de clientes

- [ ] **Datos exactos que Argemiro necesita** de cada cliente para conectar la cuenta
      (broker, servidor, plataforma MT4/MT5/cTrader, número de cuenta, contraseña, capital, otros).
- [ ] ¿Qué servicio de copy trading usa? (para evaluar más adelante si tiene API).
- [ ] Al vencer la suscripción: ¿días de gracia antes de desconectar? (propuesto: 0–3 días).
- [ ] ¿El cliente puede tener **más de una cuenta** de trading por suscripción?
- [ ] Datos personales a pedir en el registro: nombre, correo, teléfono/WhatsApp, país, documento (¿sí/no?).
- [ ] Días de recordatorio antes del vencimiento (propuesto: 7, 3, 1 y 0).
- [ ] Canal de soporte principal: WhatsApp, Telegram o correo.

## 🟢 Marca y contenido (pendiente acordado)

- [ ] Logo (SVG o PNG en alta calidad).
- [ ] Colores y tipografía de la marca.
- [ ] Fotos, videos (¿video explicativo para el inicio?).
- [ ] **Dominio:** ¿ya está comprado? ¿Cuál? ¿Quién tiene acceso a la configuración DNS?
- [ ] Correo del dominio para envíos (ej. `soporte@dominio.com`).
- [ ] Textos: descripción del software, cómo funciona, historia/perfil de Argemiro.
- [ ] **Preguntas frecuentes** con sus respuestas (depósitos, retiros, brokers, riesgo, capital mínimo…).
- [ ] **Enlace/código del widget de Myfxbook** de la cuenta auditada.
- [ ] Lista de brokers recomendados (¿con links de afiliado?).
- [ ] Redes sociales y enlaces de contacto (WhatsApp, Telegram, Instagram, YouTube…).
- [ ] Páginas de referencia o competencia que le gusten (estilo visual).

## ⚖️ Legal

- [ ] Nombre del titular para los documentos legales (persona natural o empresa, NIT/cédula, ciudad).
- [ ] Términos y condiciones de la **licencia de uso del software** (idealmente revisados por un abogado).
- [ ] Política de tratamiento de datos (Ley 1581 de 2012).
- [ ] Aviso de riesgo (sin garantía de rentabilidad; depósitos/retiros los controla el cliente con su broker).

## 🔧 Accesos técnicos (cuando empecemos)

- [ ] Cuenta/organización para hosting (Vercel, Railway/Render) y base de datos.
- [ ] Cuenta de Resend (u otro) para correos, verificada con el dominio.
- [ ] Llaves API de Binance Pay y de la pasarela COP (primero en modo prueba).
- [ ] Correos con los que se crearán las 2 cuentas de administrador (Argemiro y desarrollador).
