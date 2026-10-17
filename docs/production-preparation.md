# Preparación local TicketYa V1 — plugin

Actualización T-07: mínimo propio seleccionado, plan previo a ejecución; sin estimación de tráfico y crecimiento de capacidad requerido. Los archivos/promociones plugin son independientes de Meteor. Plan detallado en el worktree Meteor `docs/ticketya/v1-minimum-execution-plan.md`.

Dominios T-02: el usuario fijó `https://plugin.prestaya-latam.com` para este checkout y `https://tickets.prestaya-latam.com` para el portal de cuotas en Meteor. Permitió API en app o subdominio similar: se selecciona como configuración preparada `https://api-tickets.prestaya-latam.com` para apuntar al runtime TicketYa propio, conservando las dependencias financieras centrales identificadas. DNS/TLS/destino todavía no aplicados. `.env.production.example` y el default de la plantilla build incluyen ese origen; se usa sin `/api/v1` porque el cliente agrega las rutas. El dominio de alojamiento del plugin no es el valor de su variable API.

Base `2a12f63fe603554a68a6331b20e88e6ff765a1f5`, T-01 del 17/10/2026 UTC. No se instaló, compiló, publicó ni activó workflow. El checkout actual solo admite pagos sandbox y planes provisionales: no se publica como financiación productiva antes de resolver su contrato con Meteor y las condiciones acordadas.

`ticketya-build.yml.example` es una plantilla inerte fuera de `.github/workflows`. Construye un SHA explícito de este repo con una URL pública HTTPS, ejecuta lint/build y conserva un artefacto distinguible. Usa Node24 y lockfile existente; no requiere Packages token del backend. Las tres acciones se resolvieron por API al SHA de sus tags v4 el 17/10/2026, recibo operativo `action-refs.json`. No se ejecutó GitHub Actions. Los 14 días de retención son propuesta para artefactos de build, no para datos financieros.

Antes de instalarla, completar destino/autoridad y activar solo el workflow de verificación por PR/manual; ningún push/main debe desplegar por preparar documentación. En un build productivo futuro, registrar SHA, API pública y checksum del artefacto. No poner HMAC, claves BCP, URI Mongo o tokens de operadores en ninguna variable `VITE_*`.

| Parte | Contrato propuesto |
| --- | --- |
| API build | `VITE_TICKET_API_BASE_URL=https://api-tickets.prestaya-latam.com`, sin `/api/v1`, usuario, contraseña, query ni hash |
| Checkout Meteor | `TICKET_CHECKOUT_BASE_URL=https://plugin.prestaya-latam.com/pago`; CORS exacto `https://plugin.prestaya-latam.com` |
| Portal de cuotas | `https://tickets.prestaya-latam.com`, servido por meteor-stack-core en runtime TicketYa propio; OTP/cuotas son entrega de desarrollo |
| Navegación existente | La ticketera crea orden en su servidor con HMAC y redirige a `checkoutUrl`; BrowserRouter sirve `/pago` y `/confirmacion` |
| Embebido | Pendiente; no hay SDK/widget de montaje ni protocolo postMessage en esta base. Un iframe requiere origen de padres/CSP y UX aprobados; no habilitar `frame-ancestors *` por defecto |
| Hosting mínimo seleccionado | Archivos estáticos en host TicketYa propio, Caddy/TLS por hostname; `/opt/ticketya/production/plugin/releases/<sha>`. Sin CloudFront en V1; artefactos privados versionados propuestos `ticketya-production-artifacts-040084234234`, prefijo `plugin/` |
| SPA | Reescribir solo `/`, `/pago`, `/confirmacion` a index.html preservando query para el navegador; no convertir errores de assets/API en HTML200. No enviar token a logs/CDN/orígenes externos |
| Caché y cabeceras | Assets con hash/cache immutable; index revalidable; Referrer-Policy:no-referrer, nosniff, TLS; CSP según API exacta y modalidad. No añadir analítica que capture enlaces de sesión |
| Build | Permisos contents:read, sin id-token ni secretos; artefacto `ticketya-checkout-<sha>`; concurrency `ticketya-plugin-build-<ref>` |
| Deploy, todavía sin implementación | Environment `ticketya-production`, concurrency `ticketya-production-checkout`, rol candidato `ticketya-production-plugin-deploy`, OIDC repo plugin-ticketya + environment exactos |
| Permisos deploy | Publicar solo prefijo/manifiesto plugin en bucket privado TicketYa. Promotor fijo del host valida SHA/checksum y rutas del artefacto y cambia versión activa atómicamente; no shell/SSM genérico para frontend. Guardar versión/manifiesto anterior para rollback |
| Límites del rol | Sin Secrets Manager, ECR, SSM genérico, Atlas, NATS ni destinos PrestaYa/Core; bucket/state de infraestructura no es artefacto público |

No hay rol ARN, bucket, DNS o despliegue creados. La arquitectura mínima ya fue seleccionada; el usuario pidió plan/faltantes antes de ejecutar. Completar IDs/roles y delta concreto sin volver a preguntar esa selección. El root AWS único del host y estáticos es `infra/terraform/ticketya-runtime-production`, state `ticketya/production/runtime.tfstate`; el root histórico de checkout no se instancia. El build de la plantilla valida formato de URL, no demuestra que la API esté lista o que sus condiciones productivas sean válidas.

Próxima validación con código funcional nuevo: lint/build plugin contra contrato productivo, pruebas de estados/env y CORS sin exponer secretos. El backend requiere pruebas de tickets/inbox/guard y transacciones sin omisiones; no hereda el CI875 anterior. No se ejecuta staging Railway.
