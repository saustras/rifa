# PRD — Plataforma Flexible para Crear, Vender y Administrar Rifas

## 1. Visión del producto

Crear una plataforma web simple, segura y flexible para que vendedores/organizadores puedan crear sus propias rifas, configurar premios, números, método de asignación, datos de pago manual, sorteo/lotería externa, recibir comprobantes, aprobar compras y enviar automáticamente los números confirmados a los compradores.

La plataforma debe darle libertad al vendedor sin volver el producto complejo. La promesa principal es:

> Crear una rifa profesional en pocos minutos, vender números de forma ordenada, validar pagos manualmente y mantener trazabilidad completa.

El sistema no elige ganadores automáticamente en el MVP. El ganador se determina por una lotería, sorteo o mecanismo externo configurado por el vendedor. La plataforma registra la evidencia y el resultado.

## 2. Objetivos principales

- Permitir que un vendedor cree y publique rifas fácilmente.
- Permitir configurar premios, fotos, título, descripción, precio, rango de números y reglas del sorteo.
- Permitir que el vendedor elija si los números serán asignados aleatoriamente o seleccionados por el comprador.
- Permitir pagos manuales mediante transferencia, con carga de comprobante por parte del comprador.
- Permitir que el vendedor/admin apruebe o rechace comprobantes desde un panel.
- Enviar correos automáticos al comprador cuando su pago sea aprobado o rechazado.
- Notificar al vendedor cuando llegue una compra pendiente de revisión.
- Mantener auditoría de acciones sensibles.
- Evitar duplicidad de números, doble aprobación y errores de asignación.
- Dejar preparada la arquitectura para evolucionar a SaaS multi-vendedor.

## 3. Alcance del MVP profesional

### Incluye

- Registro/login de vendedor o administrador.
- Creación y edición de rifas.
- Página pública por rifa.
- Configuración de premios y fotos.
- Configuración de precio por número.
- Configuración del rango/cantidad máxima de números.
- Configuración del modo de asignación de números:
  - Aleatorio.
  - Elegido por comprador.
- Configuración de lotería/sorteo externo.
- Configuración de datos de pago manual.
- Compra pública con datos del comprador.
- Carga de comprobante de pago.
- Panel administrativo de compras pendientes.
- Sheet/drawer lateral con detalle de compra, cliente y comprobante.
- Aprobación o rechazo manual de transferencias.
- Asignación de números solo después de aprobación.
- Correo al comprador con números aprobados.
- Correo al comprador si el comprobante es rechazado.
- Notificación interna al vendedor/admin, inicialmente por Telegram.
- Listado de compradores/números.
- Exportación básica de datos.
- Registro de resultado externo con evidencia.
- Auditoría básica.

### No incluye en MVP

- Pasarela de pagos automática.
- Webhooks de pago.
- Marketplace público de rifas.
- App móvil nativa.
- WhatsApp Business API oficial.
- Wallet interna.
- Referidos complejos.
- Sorteo automático propio.
- Selección automática del ganador por algoritmo interno.
- Multi-tenant avanzado con planes y facturación SaaS.

## 4. Roles del sistema

### Comprador público

Persona que entra a una rifa pública, revisa premios, selecciona o solicita números, realiza transferencia manual, sube comprobante y espera aprobación.

### Vendedor / Organizador

Persona o negocio que crea rifas, configura premios, datos de pago, números, fecha de sorteo, revisa comprobantes y administra compradores.

### Administrador de plataforma

Controla usuarios, vendedores, rifas, auditoría, configuración global y soporte operativo.

### Auditor / Legal futuro

Rol de solo lectura para revisar rifas, compras, comprobantes, números, evidencias y acciones auditadas.

## 5. Modelo de negocio esperado

El MVP puede empezar como una herramienta para un vendedor único o pocos vendedores controlados, pero la arquitectura debe preparar el crecimiento hacia una plataforma SaaS donde cada vendedor pueda crear y administrar sus propias rifas.

Decisión base:

- El MVP será multi-vendedor simple desde el modelo de datos.
- No se construirá marketplace público en la primera fase.
- Cada rifa tendrá una URL pública propia.
- Todos los datos sensibles deben pertenecer a un vendedor/organización.

## 6. Conceptos principales

### Rifa

Unidad principal del sistema. Contiene título, descripción, premios, fotos, precio, números disponibles, modo de asignación, datos del sorteo externo y datos de pago.

### Premio

Producto o beneficio que se sortea. Una rifa puede tener uno o varios premios.

### Número

Unidad vendible de participación. Puede estar disponible, reservado, asignado, bloqueado, cancelado o ganador.

### Orden / compra

Registro creado cuando un comprador intenta participar en una rifa. Contiene datos del comprador, números solicitados/elegidos, monto esperado y comprobante.

### Comprobante

Imagen o archivo subido por el comprador para demostrar una transferencia manual.

### Revisión

Proceso manual donde el vendedor/admin acepta o rechaza una compra con comprobante.

## 7. Estados principales

### Estados de rifa

- `draft`: Borrador, no pública.
- `scheduled`: Programada para publicarse o jugar en una fecha futura.
- `active`: Disponible para recibir compras.
- `paused`: Visible o no visible según configuración, pero no recibe compras.
- `closed`: Cerrada, no recibe compras.
- `drawn`: Resultado registrado.
- `cancelled`: Cancelada.

### Estados de orden

- `pending_review`: Compra creada con comprobante, pendiente de revisión.
- `paid`: Transferencia aprobada y números asignados.
- `rejected`: Comprobante rechazado.
- `cancelled`: Compra cancelada.
- `expired`: Reserva vencida antes de revisión/aprobación, si aplica.

### Estados de número

- `available`: Disponible.
- `reserved`: Reservado temporalmente por una orden pendiente.
- `assigned`: Confirmado para una orden aprobada.
- `blocked`: Bloqueado manualmente por el vendedor/admin.
- `winner`: Número ganador registrado.
- `cancelled`: Número cancelado o invalidado.

## 8. Configuración flexible de rifas

El vendedor debe poder configurar:

- Título de la rifa.
- Slug/URL pública.
- Descripción.
- Imagen principal.
- Galería de imágenes.
- Premios.
- Precio por número.
- Moneda.
- Cantidad máxima de números.
- Rango de números.
- Formato visual de números.
- Modo de asignación.
- Fecha de cierre.
- Fecha y hora del sorteo externo.
- Lotería o fuente externa.
- Regla del ganador.
- Datos de pago manual.
- Términos y condiciones.
- Texto público de instrucciones.

### Ejemplos de numeración

Rifa de 100 números:

```txt
numberMin: 0
numberMax: 99
numberPadding: 2
display: 00 - 99
```

Rifa de 1000 números:

```txt
numberMin: 0
numberMax: 999
numberPadding: 3
display: 000 - 999
```

Rifa de 10000 números:

```txt
numberMin: 0
numberMax: 9999
numberPadding: 4
display: 0000 - 9999
```

## 9. Modos de asignación de números

### 9.1 Modo aleatorio

El comprador indica cuántos números quiere comprar.

El sistema no asigna números definitivos al crear la orden. Los números se asignan únicamente cuando el vendedor/admin aprueba el comprobante.

Flujo:

1. Comprador selecciona cantidad.
2. Sistema calcula monto.
3. Comprador sube comprobante.
4. Orden queda `pending_review`.
5. Admin aprueba.
6. Sistema asigna números disponibles de forma aleatoria o secuencial según política.
7. Orden pasa a `paid`.
8. Comprador recibe correo con sus números.

### 9.2 Modo elegido por comprador

El comprador ve una grilla/listado de números disponibles y selecciona sus números.

Flujo:

1. Comprador selecciona números disponibles.
2. Sistema valida disponibilidad.
3. Sistema crea orden con esos números en estado `reserved`.
4. Comprador sube comprobante.
5. Orden queda `pending_review`.
6. Admin aprueba o rechaza.
7. Si aprueba, números pasan a `assigned`.
8. Si rechaza, números vuelven a `available` o pasan a `blocked` según decisión.

### Reglas críticas para selección de números

- Un número no puede estar asignado a dos órdenes.
- Un número reservado no debe aparecer como disponible para otros compradores.
- Las reservas deben tener expiración configurable.
- El vendedor debe poder liberar reservas vencidas o rechazadas.
- El sistema debe evitar que un usuario bloquee demasiados números sin pago real.
- La aprobación debe realizarse dentro de una transacción de base de datos.

## 10. Flujo público del comprador

### 10.1 Ver rifa

URL esperada:

```txt
/rifas/{slug}
```

El comprador debe ver:

- Nombre de la rifa.
- Fotos del premio o premios.
- Descripción.
- Precio por número.
- Números disponibles/vendidos/reservados según configuración pública.
- Fecha de cierre.
- Fecha y hora del sorteo.
- Lotería o fuente externa.
- Regla del ganador.
- Términos.
- Datos o instrucciones de pago.
- Estado de la rifa.

### 10.2 Comprar número(s)

El comprador debe ingresar:

- Nombre completo.
- Documento o identificación.
- Correo.
- Teléfono.
- Ciudad.
- Aceptación de términos.
- Confirmación de mayoría de edad, si aplica.
- Cantidad de números o números seleccionados.
- Comprobante de transferencia.

El sistema debe mostrar:

- Monto exacto a pagar.
- Cuenta o método de pago.
- Instrucciones claras.
- Mensaje de que la compra queda pendiente hasta revisión.

### 10.3 Confirmación visual

Después de enviar la compra, el comprador ve:

```txt
Tu compra fue recibida.
Estamos revisando tu comprobante.
Recibirás un correo cuando sea aprobada o rechazada.
```

## 11. Pago manual con comprobante

El MVP usará pago manual mediante transferencia. No se integrará pasarela automática inicialmente.

El vendedor debe poder configurar datos como:

- Nombre de cuenta.
- Banco o proveedor.
- Tipo de cuenta.
- Número de cuenta/celular.
- Identificación del titular.
- Instrucciones adicionales.
- Mensaje visible al comprador.

Campos sugeridos:

```txt
paymentMethodLabel
paymentAccountHolder
paymentAccountType
paymentAccountNumber
paymentDocumentNumber
paymentInstructions
```

### Comprobante

El comprador debe poder subir:

- Imagen JPG/PNG/WebP.
- PDF opcional en fase futura.

Validaciones mínimas:

- Tamaño máximo de archivo.
- Tipo MIME permitido.
- Archivo obligatorio para crear orden.
- Almacenamiento seguro.
- URL no pública o protegida.

## 12. Panel administrativo

### 12.1 Dashboard

Debe mostrar:

- Rifas activas.
- Total vendido aprobado.
- Total pendiente de revisión.
- Compras rechazadas.
- Números disponibles.
- Números reservados.
- Números asignados.
- Últimas compras.
- Alertas de compras pendientes.
- Estado de notificaciones.

### 12.2 Gestión de rifas

El vendedor/admin puede:

- Crear rifa.
- Editar rifa.
- Cambiar título.
- Cambiar imagen principal.
- Cambiar fotos de premios.
- Cambiar descripción.
- Cambiar precio.
- Configurar número máximo/rango.
- Elegir modo aleatorio o elección por comprador.
- Configurar sorteo/lotería externa.
- Configurar datos de pago.
- Pausar rifa.
- Cerrar rifa.
- Cancelar rifa.
- Registrar resultado.

### 12.3 Wizard de creación de rifa

Para mantener facilidad, la creación debe ser guiada:

1. Información básica.
2. Premios e imágenes.
3. Números y precio.
4. Lotería/sorteo externo.
5. Datos de pago.
6. Revisión y publicación.

Cada paso debe tener valores por defecto inteligentes.

### 12.4 Gestión de compras

Listado con:

- ID de orden.
- Rifa.
- Cliente.
- Correo.
- Teléfono.
- Números solicitados/elegidos.
- Monto esperado.
- Estado.
- Fecha.
- Acción para revisar.

Filtros:

- Por rifa.
- Por estado.
- Por cliente.
- Por documento.
- Por correo.
- Por número.
- Por fecha.

### 12.5 Sheet/drawer de revisión

Al hacer click en una compra, se abre una sheet lateral con:

- Datos del cliente.
- Datos de la rifa.
- Números solicitados/elegidos.
- Monto esperado.
- Imagen del comprobante.
- Fecha de creación.
- Estado actual.
- Notas internas.
- Botón `Aceptar pago`.
- Botón `Rechazar pago`.
- Campo obligatorio de motivo al rechazar.

Al aceptar:

- Validar que la orden esté `pending_review`.
- Validar que tenga comprobante.
- Validar que la rifa esté activa o permita revisión.
- Validar disponibilidad de números.
- Asignar números.
- Marcar orden como `paid`.
- Registrar auditoría.
- Enviar correo al comprador.

Al rechazar:

- Marcar orden como `rejected`.
- Liberar o bloquear números reservados según política.
- Guardar motivo.
- Registrar auditoría.
- Enviar correo al comprador.

## 13. Notificaciones

### 13.1 Notificación interna al vendedor/admin

Para MVP se recomienda Telegram.

Motivos:

- Implementación rápida.
- Gratis.
- Llegada inmediata.
- Compatible con grupos privados.
- Permite link directo al panel admin.

Mensaje sugerido:

```txt
🎟 Nueva compra pendiente

Rifa: Moto eléctrica
Cliente: Juan Pérez
Monto: $30.000
Números: 07, 22, 91
Estado: Pendiente de revisión

Revisar: https://admin.app.com/orders/{orderId}
```

Reglas:

- No enviar documentos completos por Telegram.
- No enviar comprobantes completos por Telegram.
- Enviar solo resumen y link seguro al panel.
- Si Telegram falla, registrar error y opcionalmente enviar email fallback.

### 13.2 Correos al comprador

Correos mínimos:

#### Compra recibida

Asunto:

```txt
Recibimos tu compra
```

Contenido:

- Nombre de rifa.
- Monto.
- Estado pendiente.
- Mensaje de revisión.

#### Pago aprobado

Asunto:

```txt
Pago aprobado - estos son tus números
```

Contenido:

- Nombre del comprador.
- Nombre de rifa.
- Números asignados.
- Fecha y hora del sorteo.
- Lotería o fuente externa.
- Regla del ganador.
- Link a la rifa.

#### Pago rechazado

Asunto:

```txt
No pudimos aprobar tu comprobante
```

Contenido:

- Nombre de rifa.
- Motivo general o específico.
- Instrucciones para contactar o volver a intentar.

#### Resultado registrado

Asunto:

```txt
Resultado de la rifa
```

Contenido:

- Número ganador.
- Lotería/fuente externa.
- Link o evidencia.
- Instrucciones de contacto.

## 14. Sorteo externo y resultado

El vendedor configura con qué lotería/sorteo externo juega la rifa.

Campos:

```txt
drawSourceName
drawDate
drawTime
drawRule
externalResultUrl
winningNumber
evidenceUrl
adminNotes
```

Ejemplos de reglas:

- Últimas 2 cifras del premio mayor.
- Últimas 3 cifras del premio mayor.
- Número completo.
- Sorteo externo manual registrado por evidencia.

Cuando se registra resultado:

- Se marca número ganador como `winner`.
- Se marca la rifa como `drawn`.
- Se bloquean nuevas compras.
- Se guarda evidencia.
- Se audita acción.
- Se puede enviar correo informativo.

## 15. Seguridad básica

Requisitos mínimos:

- Autenticación para vendedores/admins.
- Hash seguro de contraseñas.
- Roles y permisos básicos.
- Rate limit en endpoints públicos.
- Validación fuerte de inputs.
- Validación de archivos subidos.
- No exponer comprobantes públicamente.
- URLs firmadas o acceso autenticado para comprobantes.
- Protección contra doble aprobación.
- Protección contra doble asignación de números.
- Auditoría de acciones sensibles.
- Variables de entorno para secretos.
- No guardar datos financieros sensibles innecesarios.
- Exportaciones protegidas.
- Separación de datos por vendedor/organización.

## 16. Idempotencia y consistencia

Aunque el pago sea manual, el sistema debe ser idempotente.

Reglas críticas:

- Una orden aprobada no puede aprobarse dos veces.
- Una orden rechazada no puede aprobarse sin flujo explícito de reapertura.
- Una orden sin comprobante no puede aprobarse.
- Un número no puede asignarse a dos órdenes.
- La asignación de números debe ocurrir en una transacción.
- El cambio de estado de orden y números debe ser atómico.
- Si el envío de correo falla, no debe revertir la aprobación; debe quedar como job/reintento.
- Si la notificación Telegram falla, la compra debe seguir creada y el error debe registrarse.

Restricciones recomendadas:

```txt
unique(raffle_id, number)
unique(order_id, number_id)
```

Operación de aprobación:

```txt
BEGIN TRANSACTION
  bloquear orden
  validar estado pending_review
  validar comprobante
  validar números disponibles/reservados
  asignar números
  cambiar orden a paid
  crear audit log
COMMIT

crear job de email
crear job de notificación si aplica
```

## 17. Auditoría

Cada acción importante debe guardar:

```txt
auditLogId
sellerId
actorUserId
actorRole
entityType
entityId
action
beforeData
afterData
ipAddress
userAgent
createdAt
```

Eventos auditables:

- Rifa creada.
- Rifa editada.
- Rifa publicada.
- Rifa pausada.
- Rifa cerrada.
- Premio creado/editado.
- Orden creada.
- Comprobante subido.
- Compra aprobada.
- Compra rechazada.
- Números reservados.
- Números asignados.
- Números liberados.
- Número bloqueado.
- Resultado registrado.
- Correo enviado.
- Notificación enviada.
- Exportación generada.

## 18. Modelo de datos recomendado

### sellers

```txt
id
name
email
phone
status
telegram_chat_id
created_at
updated_at
```

### users

```txt
id
seller_id
name
email
password_hash
role
status
last_login_at
created_at
updated_at
```

### raffles

```txt
id
seller_id
title
slug
description
status
cover_image_url
price_per_number
currency
number_min
number_max
number_padding
assignment_mode
reservation_ttl_minutes
draw_source_name
draw_date
draw_time
draw_rule
terms
payment_method_label
payment_account_holder
payment_account_type
payment_account_number
payment_document_number
payment_instructions
created_at
updated_at
```

### raffle_prizes

```txt
id
raffle_id
title
description
image_url
commercial_value
position
created_at
updated_at
```

### raffle_numbers

```txt
id
raffle_id
number
display_number
status
reserved_by_order_id
assigned_to_order_id
reserved_at
assigned_at
created_at
updated_at
```

### customers

```txt
id
seller_id
full_name
document_type
document_number
email
phone
city
accepted_terms_at
is_adult_confirmed
created_at
updated_at
```

### orders

```txt
id
seller_id
raffle_id
customer_id
status
amount
currency
numbers_requested
payment_proof_url
payment_proof_uploaded_at
reviewed_by_user_id
reviewed_at
rejection_reason
admin_notes
created_at
updated_at
```

### order_numbers

```txt
id
order_id
raffle_number_id
number
display_number
status
created_at
updated_at
```

### draw_results

```txt
id
raffle_id
external_source
external_draw_date
winning_number
winner_order_id
winner_customer_id
evidence_url
notes
registered_by_user_id
registered_at
created_at
```

### notification_logs

```txt
id
seller_id
order_id
raffle_id
channel
type
recipient
status
provider_message_id
error_message
sent_at
created_at
```

### audit_logs

```txt
id
seller_id
actor_user_id
actor_role
entity_type
entity_id
action
before_data
after_data
ip_address
user_agent
created_at
```

## 19. API principal

### Público

```txt
GET  /api/public/raffles/:slug
GET  /api/public/raffles/:slug/numbers
POST /api/public/raffles/:slug/orders
POST /api/public/orders/:orderId/proof
GET  /api/public/orders/:orderId/status
GET  /api/public/raffles/:slug/result
```

### Admin / vendedor

```txt
GET    /api/admin/dashboard

GET    /api/admin/raffles
POST   /api/admin/raffles
GET    /api/admin/raffles/:id
PATCH  /api/admin/raffles/:id
POST   /api/admin/raffles/:id/publish
POST   /api/admin/raffles/:id/pause
POST   /api/admin/raffles/:id/close
POST   /api/admin/raffles/:id/cancel

GET    /api/admin/raffles/:id/prizes
POST   /api/admin/raffles/:id/prizes
PATCH  /api/admin/prizes/:id
DELETE /api/admin/prizes/:id

GET    /api/admin/orders
GET    /api/admin/orders/:id
POST   /api/admin/orders/:id/approve
POST   /api/admin/orders/:id/reject

GET    /api/admin/customers
GET    /api/admin/numbers
POST   /api/admin/numbers/:id/block
POST   /api/admin/numbers/:id/release

POST   /api/admin/raffles/:id/draw-result
GET    /api/admin/raffles/:id/export
GET    /api/admin/audit-logs
```

### Notificaciones

```txt
POST /api/admin/settings/telegram/test
PATCH /api/admin/settings/notifications
```

## 20. Requisitos no funcionales

### Rendimiento

- Página pública debe cargar rápido en móvil.
- Soporte inicial para 10.000 números por rifa.
- Búsqueda por documento, correo y número.
- Listado de números con paginación o renderizado eficiente.
- Dashboard con métricas precalculadas o consultas optimizadas.

### Disponibilidad

- Logs persistentes.
- Backups de base de datos.
- Reintentos para correos.
- Reintentos controlados para notificaciones.
- Manejo seguro de fallos de almacenamiento de archivos.

### Escalabilidad

- Separar API, web pública y admin.
- Separar paquetes compartidos de tipos, validación y base de datos.
- Procesar correos y notificaciones mediante jobs.
- Preparar integración futura con pasarela de pagos.

## 21. Stack recomendado

### Monorepo

- pnpm workspaces.
- Nx recomendado para controlar apps, paquetes, boundaries y tareas.

### Apps

- `apps/public-web`: React + Vite.
- `apps/admin-web`: React + Vite.
- `apps/api`: Node.js HTTP + TypeScript en el MVP; Fastify/NestJS queda como opción futura si la API crece.

### Paquetes

- `packages/db`: schema, migrations, seed.
- `packages/shared`: tipos y constantes.
- `packages/validation`: schemas Zod.
- `packages/config`: configuración compartida.

### Infra

- PostgreSQL.
- Redis + BullMQ para jobs.
- S3 compatible para imágenes y comprobantes.
- SMTP profesional o Resend/SendGrid/Mailgun.
- Telegram Bot API para notificaciones internas.
- Cloudflare o proxy similar en producción.

## 22. Criterios de aceptación del MVP

El MVP se considera listo cuando:

- Un vendedor/admin puede iniciar sesión.
- Un vendedor/admin puede crear una rifa.
- Puede configurar título, fotos, premios, precio, rango de números y sorteo externo.
- Puede elegir modo aleatorio o selección de números por comprador.
- La rifa tiene una página pública.
- Un comprador puede elegir números o cantidad, según configuración.
- Un comprador puede subir comprobante de pago.
- La orden queda pendiente de revisión.
- El vendedor recibe notificación interna por Telegram o fallback configurado.
- El admin puede abrir una sheet con datos del cliente y comprobante.
- El admin puede aceptar o rechazar la transferencia.
- Al aceptar, se asignan números sin duplicados.
- Al aceptar, el comprador recibe correo con números y datos del sorteo.
- Al rechazar, el comprador recibe correo con aviso.
- El admin puede ver compradores, órdenes y números.
- El admin puede registrar resultado externo con evidencia.
- Todo evento sensible queda auditado.
- No existe forma de asignar el mismo número dos veces.
- No existe forma de aprobar la misma orden dos veces.

## 23. Fases sugeridas

### Fase 0 — Fundación

- Crear monorepo.
- Definir arquitectura.
- Crear schema base.
- Definir contratos compartidos.
- Configurar DB, env, lint, formatter y scripts.

### Fase 1 — MVP operativo

- Login admin/vendedor.
- CRUD de rifas.
- CRUD de premios.
- Página pública.
- Compra con comprobante.
- Revisión admin.
- Aprobación/rechazo.
- Asignación de números.
- Email al comprador.
- Telegram al vendedor.
- Auditoría básica.

### Fase 2 — Operación y confianza

- Exportaciones.
- Reportes.
- Resultado externo con evidencia.
- Mejoras de seguridad.
- Gestión avanzada de reservas.
- Mejor UX móvil.

### Fase 3 — Crecimiento SaaS

- Planes y facturación.
- Marketplace opcional.
- WhatsApp Business.
- Pasarela de pagos.
- Dominios/subdominios personalizados.
- Plantillas de rifas.
