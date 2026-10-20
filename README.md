# Ticketya Cuotas

Checkout para pagar entradas en cuotas. React, TypeScript, Vite, Tailwind, shadcn/ui (Ocean Breeze), React Router y React Hook Form con Zod. El proyecto vive directamente en esta carpeta.

## Desarrollo local

Requiere Node.js 22.12+ y npm. Con Meteor corriendo en `http://localhost:3130`:

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Abre la **URL devuelta por la API de órdenes**, por ejemplo `http://localhost:5173/pago?session=TOKEN`. Entrar sin sesión muestra las instrucciones para abrir el enlace de la ticketera; nunca carga una orden ficticia.

La API se configura con `VITE_TICKET_API_BASE_URL` (ver `.env.example`). En desarrollo, el valor predeterminado es `http://localhost:3130`; para producción hay que configurarlo al compilar. Es una URL pública, sin secretos. El origen donde se abre el checkout debe coincidir con `TICKET_CHECKOUT_BASE_URL` en Meteor: en local usa `http://localhost:5173`, pues `127.0.0.1` es un origen distinto para CORS.

```sh
npm run build
npm run lint
```

## Órdenes y calendario

El plugin lee `GET /api/v1/ticket-checkout/session` con `Authorization: Bearer TOKEN`, sin cookies ni caché. Valida la respuesta con Zod y muestra el evento, la ticketera, todas las entradas con sus cantidades, el total en Bs y cada cuota con su importe, fecha completa y estado. Las fechas se muestran en la zona horaria del evento; las órdenes antiguas usan hora de Bolivia. Hay estados de carga, reintento, enlace inválido, sesión vencida y orden no disponible, sin recurrir a datos de ejemplo.

La regla nueva `TICKET_FINANCING_V3` **solo pertenece al módulo de tickets en Meteor**:

- Anticipo: 25% del precio original anunciado, separado de las cuotas financiadas.
- Capital: precio vigente al contratar menos anticipo.
- Intereses: número de cuotas financiadas × precio vigente × tasa por cuota. No se calculan sobre el saldo.
- Para pruebas locales autorizadas: 2% por cuota y máximo tres cuotas financiadas. No son condiciones comerciales aprobadas.
- Calendario: al menos 7 días calendario entre pagos, preferencia por los días 10/25 y última cuota como máximo en la víspera del evento. El backend reduce la cantidad hasta obtener un plan válido o rechaza la financiación.
- Los centavos sobrantes van en la última cuota. Anticipo e interés total se redondean a centavos con mitad hacia arriba.

El checkout muestra el anticipo más las n cuotas, precios original y vigente, capital, intereses y total. Por ejemplo: precio original Bs 1.500, vigente Bs 1.800, anticipo Bs 375, tres cuotas de Bs 511 y total Bs 1.908. El backend guarda una copia de los importes, la tasa y las condiciones. El checkout **no calcula ni elige cuotas**; las órdenes antiguas siguen mostrando su plan anterior sin añadirles intereses nuevos.

Las fechas son previstas hasta confirmar el anticipo. Meteor las valida con la fecha bancaria sin cambiar las condiciones aceptadas: consolida el calendario si coincide o registra el pago y deja la orden en revisión si necesita cambios.

## Pago del anticipo mediante BCP

1. Revisar el plan y su timeline.
2. Completar los datos del comprador y aceptar el plan. Se guardan en Meteor al solicitar el QR, junto con la versión y la huella de las condiciones aceptadas.
3. El plugin consulta `GET /api/v1/ticket-checkout/payment`. Si no existe cobro, solicita `POST /api/v1/ticket-checkout/payment-qr` con el Bearer de la sesión, comprador, `accepted: true` y `termsVersion` de la orden. No envía importes: Meteor obtiene el anticipo guardado y usa su servicio BCP.
4. Mostrar la imagen PNG base64 que devuelve BCP. Cerrar y reabrir conserva el cobro; no se genera un QR ficticio ni se permite marcarlo manualmente como pagado.
5. Consultar Meteor cada 5 segundos hasta que la orden confirme el anticipo. Meteor recibe el callback bancario o consulta BCP y registra movimiento, anticipo y saldo de forma transaccional e idempotente.
6. La pantalla de confirmación vuelve a leer la orden. No acepta estados de pago de la navegación o del navegador; recargar conserva la confirmación registrada.

El diálogo muestra estados de carga, espera, QR vencido, error o revisión. Un resultado incierto no crea otro cobro automáticamente. Meteor continúa procesando las notificaciones aunque el cliente cierre la pestaña o venza el enlace. Un calendario diferente del aceptado queda para revisión sin cambiar importes ni fechas silenciosamente.

**BCP debe estar configurado, verificado y activo en Meteor.** Si está deshabilitado o faltan credenciales/certificado, se muestra el error de configuración sin QR alternativo. La prueba contra el banco se hará después de desplegar en staging con BCP sandbox, callback público HTTPS y sus secretos. Estas rutas permanecen bloqueadas en producción. La configuración actual de BCP admite anticipos de Bs 1 a Bs 1.000; las órdenes antiguas sin anticipo requieren una nueva cotización para usar este cobro.

El runtime separado del plugin usa el servicio central de Meteor mediante un
consumidor privado, con correlación por orden/cuota, respuestas firmadas y
recuperación persistente de confirmaciones. Las variables `PLUGIN_PAYMENTS_*`
pertenecen al backend; no se agregan a Vite. Configuración y prueba tras despliegue:
`meteor-stack-core/docs/ticketya/central-payments.md`. La interfaz muestra «Pruebas»
solo cuando el servicio informa `sandbox`.

El token se conserva entre pago y confirmación y no se guarda en localStorage. Una sesión de checkout vencida requiere un nuevo enlace. Las compras con pagos registrados se consultan por separado en `/mis-cuotas`, con acceso por correo. Este QR es de cobro bancario, no de acceso al evento: la emisión de entradas queda pendiente.

El checkout muestra una cuenta regresiva `mm:ss` basada en `expiresAt`, sin reiniciar los 30 minutos al recargar o cambiar de paso. En móvil, el temporizador y la acción principal de cada paso están en una barra fija inferior con espacio para el área segura del dispositivo. En escritorio, el contador aparece arriba y los botones permanecen dentro del contenido. El diálogo del QR también muestra el tiempo del enlace; al vencer la sesión se cierra el flujo de pago.

## Portal del comprador de Plugin TicketYa

Abre `/mis-cuotas`, o usa «Mis cuotas» en la cabecera. Ingresa el correo utilizado
en la compra y el código de seis dígitos enviado a esa dirección. La sesión se
recupera al recargar; vence a los siete días y permite salir explícitamente.
No se guardan códigos/tokens en localStorage ni en URLs.

El portal muestra las compras con al menos un pago confirmado, sus entradas,
saldo y calendario con cuotas pagadas, pendientes y vencidas. Tiene detalle por
compra en `/mis-cuotas/:orderId`, paginación, lista vacía y recuperación de errores.
No depende del token de checkout ni calcula condiciones nuevas. «Pagar cuota»
solicita el QR de la siguiente cuota pendiente y consulta su confirmación cada
cinco segundos. Solo actualiza la compra cuando el backend registra el pago.
Los cobros vencidos o inciertos se consultan sin regenerarlos automáticamente.

Consume `/api/v1/ticket-buyer/{code,verify,session,orders}` del backend aislado
en Meteor, con cookies HttpOnly y CORS del origen exacto. Para desarrollo:
`VITE_BUYER_API_BASE_URL=http://localhost:3131`; si no se define, hereda
`VITE_TICKET_API_BASE_URL` (o 3131 cuando tampoco existe esa variable en local).
Usa el mismo hostname en ambos servidores. Al compilar producción hereda la URL
pública de la API, sin añadir secretos al frontend.

El backend necesita correo configurado: modo `local` solo en desarrollo, leyendo
el archivo privado del código, o SES con remitente/rol propios verificados. El
frontend no implementa códigos de prueba ni datos ficticios; si falta configurar
el servidor, muestra que el acceso todavía no está disponible. El contrato y las
variables están en `meteor-stack-core/docs/ticketya/plugin-buyer-portal.md`.

Desde el checkout se abre el portal en otra pestaña para que el login no dependa
de cookies de terceros dentro del iframe. El portal pertenece a **Plugin TicketYa**;
es distinto del acceso de operadores y de la otra aplicación llamada TicketYa.

## Estructura

```text
src/features/checkout/
  order-api.ts               Contrato Zod y consulta autenticada de la sesión
  checkout-session.tsx        Carga, errores, reintento y vencimiento
  checkout-page.tsx           Plan, formulario y revisión de pago
  financing-breakdown.tsx    Precios, anticipo, capital, intereses y total
  installment-timeline.tsx    Fechas, importes y estados de cada cuota
  ticket-summary.tsx          Resumen de la orden consultada
  confirmation-page.tsx      Confirmación leída del estado bancario en Meteor
  bcp-qr-payment.tsx          Imagen de BCP, estados y consulta automática
  checkout-utils.ts          Formatos BOB/Bolivia y validación del comprador
```

El portal está en `src/features/buyer/`: `buyer-api.ts` (contratos/acceso),
`buyer-plan.ts` (estados de cuotas) y `buyer-portal.tsx` (login/compras/detalle).

Al desplegar, configura el hosting para servir `index.html` en `/pago`, `/confirmacion` y `/mis-cuotas/*`. El Caddy actual ya aplica este fallback. Para añadir componentes: `npx shadcn@latest add nombre-del-componente`.

## Producción TicketYa

La identidad lógica de esta integración es **`plugin-ticketya`**. Los nombres
físicos históricos `ticketya-production` del bucket/roles/host no identifican otra
aplicación ni se renombran al publicar. El manifiesto añade `application_code` y
mantiene el sobre de transporte anterior para los estáticos ya desplegados.
La revisión y las comprobaciones de aislamiento están documentadas en
`meteor-stack-core/docs/ticketya/plugin-application-boundary.md`.

El workflow `.github/workflows/ticketya-production.yml` valida y construye cada candidato, con `VITE_TICKET_API_BASE_URL=https://api-tickets.prestaya-latam.com` al compilar. Un push/merge a main publica el artefacto identificado por SHA y encola su versión. El rol solo publica el prefijo plugin; no puede ejecutar shell, leer secretos del runtime ni desplegar PrestaYa.

El host TicketYa activa los estáticos de forma atómica en la ventana diaria04:00 Bolivia o mediante el ejecutor manual autorizado, con la misma exclusión y comprobación de base. Sin candidato pendiente no cambia el servicio. Un despliegue manual consumido no se repite en la siguiente ventana.

URL desplegada: `https://plugin.prestaya-latam.com/pago`, con DNS/TLS verificados y respuesta pública200. La delegación autoritativa está en Route53; no hace falta editar IONOS. La disponibilidad del backend, acceso común, portal de cuotas y habilitación productiva dependen de las entregas reales de meteor-stack-core; desplegar este plugin no completa esas funciones ni habilita cobros. Los padres iframe se autorizan exactamente por onboarding; por defecto quedan cerrados.
