# Pendientes — información por recibir

> Para resolver en la reunión con Argemiro. Marcar con `[x]` a medida que se reciba.

## 🔴 Bloquean el inicio del desarrollo

- [x] **Tecnología confirmada:** NestJS (API) + Next.js (web).
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
- [ ] ¿Precio en cripto fijo en USD (USDT) y BTC calculado al cambio del momento? (propuesto: sí).
- [ ] ¿Cuánto tiempo es válida una orden de pago antes de expirar? (propuesto: 60 minutos para cripto).
- [x] **Reembolsos:** no hay devoluciones.
- [x] **Prueba:** USD 50 por 1 mes, solo si el cliente la solicita. Completar: USD 450 por 5 meses más.

### Precios
- [x] **Licencia normal:** 5 meses + 1 de obsequio = 6 meses por USD 499.
- [x] **Cupón del mes de obsequio:** se aplica automáticamente.
- [x] **Renovación:** cuesta lo mismo (incluye el mes de obsequio).
- [x] **Prueba:** se completa hasta el último día de la prueba; los 5 meses se suman al final.
- [x] **Prueba:** el cliente la solicita con un botón, Argemiro la aprueba y el cliente paga USD 50.
- [x] **Precios en COP:** todas las licencias se cobran al equivalente de su precio en USD con la TRM del día.
      (Reemplaza los precios fijos COP 2.000.000 / 200.000 / 1.800.000.)
- [x] **Licencia trimestral:** USD 319 por 3 meses. Semestral de USD 599 descartado.
- [x] Un cliente trimestral puede pasarse a la licencia de 6 meses antes de vencer; los días se suman.
- [x] Completar la prueba **no** lleva mes de obsequio.
- [ ] Fuente de la TRM (propuesto: la TRM oficial publicada por la Superintendencia Financiera / datos.gov.co)
      y si se redondea el precio en pesos (propuesto: a los 1.000 pesos más cercanos).
- [ ] ¿La prueba puede completarse también con la trimestral? (propuesto: no, solo con los 5 meses de USD 450).

## 🟡 Operación y cuentas de clientes

- [x] **Datos para conectar la cuenta:** nombre completo, número de cuenta, broker, servidor,
      contraseña operativa y contraseña de inversor.
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
- [x] Broker sugerido: JustMarkets con el link de referido de Argemiro.
- [x] Solo JustMarkets como broker recomendado por ahora.
- [x] **LPOA:** uno por cliente.
- [ ] **Archivo de la plantilla del LPOA:** Argemiro lo envía más adelante.
- [ ] ¿El LPOA debe firmarse a mano (escaneado) o sirve firma digital?
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
