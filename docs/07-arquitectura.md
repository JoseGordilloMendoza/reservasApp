# 07 - Arquitectura

> Borrador v0.2. Es una **propuesta** para discutir. Se apoya en la experiencia previa del equipo con Django, DRF y React (proyecto KAJA), lo que reduce el costo de aprendizaje.
>
> **Convención:** la documentación está en español; el código, los nombres de modelos, campos, rutas de la API y commits van en **inglés**. El [glosario](04-glosario.md) relaciona ambos.

## 1. Principios

1. **Monolito modular.** Una sola aplicación bien organizada en módulos. Para este tamaño, los microservicios solo añadirían complejidad.
2. **La base de datos protege la integridad.** Lo crítico (sin reservas solapadas) se garantiza con restricciones en PostgreSQL.
3. **Configuración antes que código.** Lo que varía por negocio vive en datos validados.
4. **Dependencias externas reemplazables.** Correo, almacenamiento y WhatsApp se usan detrás de una interfaz propia.
5. **Costo bajo.** Pocos componentes, todos con planes económicos o gratuitos.

## 2. Stack propuesto

| Capa | Elección | Motivo |
|---|---|---|
| Backend | Python, Django 5.2 y Django REST Framework | Ya lo conoces; el admin integrado sirve como panel de superadmin inicial |
| Base de datos | PostgreSQL | Necesaria para la restricción de exclusión que evita solapamientos |
| Frontend | React con Vite y TypeScript, como PWA | Ya lo conoces; instalable y sin tiendas de apps |
| Tareas programadas | Comando de Django invocado por un cron externo, opcional | La corrección no depende de él (ver sección 4) |
| Correo | Proveedor transaccional con capa gratuita | Costo mínimo |
| Repositorio | Monorepo con `backend/`, `frontend/` y `docs/` | Documentación y código juntos |
| Contenedores | Docker y Docker Compose para desarrollo (PostgreSQL y backend) | Entorno reproducible. El despliegue sigue pendiente |

## 3. Multi-tenancy

**Una sola base de datos y un solo esquema, con una columna `business_id` en cada tabla del negocio.**

- Es lo más simple de operar y de migrar, y alcanza para cientos de negocios.
- El aislamiento se centraliza en una capa común: todas las consultas pasan por un gestor que filtra por negocio, y las pruebas automáticas verifican que no haya fugas (NF-02).
- La alternativa de un esquema por negocio queda descartada por complejidad de migraciones y operación.

El **negocio activo** se determina así: en la web pública, por el slug de la URL; en el panel, por el usuario autenticado.

## 4. Modelo de datos (borrador)

```
Business ──< Resource ──< Service
   │            │
   │            ├──< AvailabilityRule   (horario semanal)
   │            ├──< Block              (excepciones)
   │            └──< Booking >── Customer
   │
   ├──< User            (dueño; luego staff con roles)
   ├──< Customer        (por negocio, clave: celular)
   └─── Subscription    (plan, precio, vigencia)

Booking ──< BookingEvent   (historial de estados)
```

| Entidad | Campos clave |
|---|---|
| **Business** | `slug` único, `name`, perfil público, `timezone`, `business_type` (plantilla de rubro), `settings` (JSON validado), `status` |
| **Resource** | `business`, `name`, `is_active`, `position` |
| **Service** | `resource`, `name`, `duration_minutes`, `reference_price`, `settings` que sobrescribe la del negocio |
| **AvailabilityRule** | `resource`, `weekday`, `start_time`, `end_time` |
| **Block** | `resource` (o todo el negocio), `starts_at`, `ends_at`, `reason` |
| **Customer** | `business`, `name`, `phone` en formato `+51...`, `email` opcional, `is_blocked` |
| **Booking** | `business`, `resource`, `service`, `customer`, `starts_at`, `ends_at`, `status`, `expires_at`, `price_snapshot`, `duration_snapshot`, `source`, `series_id` (vacío en el MVP), `manage_token_hash` |
| **BookingEvent** | `booking`, `from_status`, `to_status`, `created_at`, `actor` |
| **Subscription** | `business`, `plan`, `price`, `starts_on`, `valid_until`, `status` |

Estados de `Booking.status` en código: `pending`, `confirmed`, `completed`, `cancelled`, `expired`, `no_show`.

### Integridad contra solapamientos

PostgreSQL permite una **restricción de exclusión** sobre rangos de tiempo. Django la soporta con `ExclusionConstraint` y la extensión `btree_gist`:

```
no puede haber dos filas con el mismo recurso y rangos de tiempo
que se solapen, salvo que el estado sea cancelled o expired
```

Solo `cancelled` y `expired` liberan el horario; `pending`, `confirmed`, `completed` y `no_show` lo ocupan. Así el historial tampoco tiene reservas solapadas. Los rangos son semiabiertos: una reserva que termina a las 19:00 no choca con otra que empieza a las 19:00.

Así, aunque dos solicitudes lleguen al mismo milisegundo, la base de datos rechaza la segunda. **Implementado y probado en el hito M1** (`backend/apps/bookings`).

> **Requisito del hosting:** el proveedor de PostgreSQL debe permitir la extensión `btree_gist`. Hay que confirmarlo antes de elegirlo.

### Expiración sin depender de un cron

La restricción no puede depender de la hora actual, y los hostings gratuitos a veces no ofrecen tareas programadas fiables. Por eso la corrección se logra así:

1. **Al consultar disponibilidad**, una reserva `pending` con `expires_at` vencido se trata como libre.
2. **Al crear una reserva**, dentro de la misma transacción se marcan como `expired` las pendientes vencidas que se solapan con el nuevo horario.
3. Un **cron opcional** pasa el resto a `expired` para mantener los datos ordenados y enviar avisos.

Si el cron falla, el sistema sigue siendo correcto.

### Configuración flexible

- `settings` del negocio y del servicio es un JSON cuya forma se valida con un esquema versionado.
- Al leer un valor se busca en este orden: **servicio → negocio → valor por defecto de la plataforma**.
- Al crear un negocio se elige una **plantilla de rubro** (cancha, psicólogo) que precarga sus valores. Después el negocio los ajusta como quiera.
- Agregar una opción nueva implica definirla en el esquema con su valor por defecto; los negocios existentes no necesitan migración.
- Al crear un negocio se guarda una **copia completa** de los valores de su plantilla. Así, un cambio posterior en los valores por defecto de la plataforma no altera el comportamiento de negocios ya creados.
- Al guardar se rechazan claves desconocidas y valores fuera de rango. Al leer se ignoran las claves obsoletas.

**Opciones implementadas** (`backend/apps/businesses/settings_schema.py`). Todos los tiempos van en minutos para evitar confusiones de unidades; la interfaz los mostrará en horas o días cuando convenga.

| Clave | Valor por defecto | Rango o valores |
|---|---|---|
| `confirmation_mode` | `manual` | `manual`, `automatic` |
| `pending_hold_minutes` | 120 | 5 a 10 080 |
| `cancellation_notice_minutes` | 1 440 | 0 a 43 200 |
| `min_booking_notice_minutes` | 60 | 0 a 43 200 |
| `booking_horizon_days` | 30 | 1 a 365 |
| `slot_interval_minutes` | 60 | 5 a 240 |
| `buffer_minutes` | 0 | 0 a 240 |
| `max_active_bookings_per_customer` | 3 | 1 a 50 |

### Disponibilidad

Los horarios libres **no se almacenan**: se calculan al consultar, a partir de reglas, bloqueos y reservas. Evita datos desactualizados y facilita las reservas recurrentes más adelante.

**Implementado** en `backend/apps/availability/slots.py`:

- `get_available_slots(resource, service, from_date, to_date)` devuelve los horarios libres entre dos fechas locales, en UTC. Admite hasta 62 días por consulta.
- La lógica de cálculo (`build_slots`) es una función pura, sin acceso a la base de datos, lo que facilita probarla.
- Los horarios de atención se convierten de hora local a UTC con la zona horaria del negocio, así que un cambio de hora (por ejemplo en `America/New_York`) se calcula con tiempo real transcurrido. Perú no tiene cambio de hora, pero el código no lo asume.
- Una reserva pendiente cuya expiración ya pasó no ocupa el horario, aunque ningún proceso la haya marcado todavía como `expired`.
- El descanso entre reservas (`buffer_minutes`) lo aplica este cálculo y **no** la base de datos, que solo impide el solapamiento exacto. Por eso, cuando M4 cree reservas, debe volver a validar contra este cálculo dentro de la misma transacción.
- Los bloqueos (`Block`) sin recurso cierran todo el negocio.

## 5. API

API REST en `/api/v1/`, dividida por audiencia:

| Zona | Ejemplo | Autenticación |
|---|---|---|
| Pública | Ver la tabla siguiente | Ninguna, con límite de solicitudes |
| Gestión del cliente | `GET /api/v1/public/bookings/{token}/` y `POST .../cancel/` | Token del link |
| Autenticación | `/api/v1/auth/login/`, `google/`, `refresh/`, `logout/`, `me/` | Ninguna (salvo `me/`), con límite de intentos |
| Panel del negocio | `/api/v1/panel/...` (ver más abajo) | Token JWT del usuario |
| Superadmin | `/admin/` de Django en el MVP | Sesión de superusuario |

### API pública implementada (M4)

| Método y ruta | Qué hace | Errores propios |
|---|---|---|
| `GET /api/v1/public/businesses/{slug}/` | Página del negocio: recursos y servicios activos | 404 si no existe o está suspendido |
| `GET /api/v1/public/businesses/{slug}/availability/?resource=&service=&date=[&to_date=]` | Horarios libres en UTC y zona horaria del negocio | 400 parámetros inválidos o rango mayor a 62 días |
| `POST /api/v1/public/businesses/{slug}/bookings/` | Crea una reserva sin cuenta; devuelve `manage_token` una sola vez | 400 datos inválidos, 403 `booking_not_allowed`, 409 `slot_unavailable` o `too_many_active_bookings`, 429 demasiadas solicitudes |
| `GET /api/v1/public/bookings/{token}/` | Estado de la reserva, `can_cancel` y `cancel_deadline` | 404 |
| `POST /api/v1/public/bookings/{token}/cancel/` | Cancela la reserva | 403 `cancellation_window_closed`, 409 `not_cancellable` |

Las rutas usan `businesses/{slug}` y `bookings/{token}` para que un negocio nunca pueda chocar con la ruta de reservas por su nombre. Los errores de reglas devuelven `{"code": "...", "detail": "..."}`; `code` es estable para el frontend y `detail` está en español.

**Cómo se crea una reserva** (`backend/apps/bookings/services.py`), todo dentro de una transacción:

1. Se bloquea la fila del recurso, de modo que las reservas de un mismo recurso se crean de una en una. Esto hace seguro el descanso entre reservas, que la base de datos no puede verificar por sí sola.
2. Se busca o crea al cliente por celular y se bloquea su fila; se rechaza si está bloqueado o ya llegó al máximo de reservas activas.
3. Se expiran las reservas pendientes vencidas que estorban en ese horario.
4. Se verifica que el horario sea exactamente uno de los que ofrece la disponibilidad.
5. Se inserta la reserva; la restricción de exclusión de PostgreSQL queda como respaldo final.
6. Se guarda un `BookingEvent` y se devuelve el token. En la base de datos solo queda su hash SHA-256.

Hay pruebas con hilos y conexiones reales: 8 solicitudes simultáneas al mismo horario producen una sola reserva, y el tope por cliente y el descanso entre reservas se respetan aunque las solicitudes lleguen a la vez.

**Límite de solicitudes** (por dirección del cliente): lectura 120 por minuto, creación de reservas 30 por hora, gestión por link 60 por minuto. En Perú varias personas comparten la misma dirección en redes móviles, por eso el límite de creación es holgado y el control real es el tope de reservas activas por celular.

**Borrado:** un recurso, servicio o cliente con reservas no se puede borrar (`RESTRICT`); un negocio completo sí, y arrastra todo lo suyo. Lo normal es suspender, no borrar.

### Autenticación (M5)

**Usuario:** modelo propio (`accounts.User`) donde el email es el identificador, guardado en minúsculas y único. Un `Membership` une a un usuario con un negocio y su rol (`owner` o `staff`); los superusuarios son el equipo de la plataforma y no tienen negocio.

**Sesión:** tokens JWT, porque el frontend se servirá desde otro dominio que la API.

| Ruta | Qué hace |
|---|---|
| `POST /api/v1/auth/login/` | Email y contraseña → `access` (15 min), `refresh` (7 días) y el usuario con sus negocios |
| `POST /api/v1/auth/google/` | Token de identidad de Google → la misma sesión |
| `POST /api/v1/auth/refresh/` | Renueva el acceso y **rota** el refresh: el anterior queda invalidado |
| `POST /api/v1/auth/logout/` | Invalida el refresh |
| `GET /api/v1/auth/me/` | Usuario actual y sus negocios |

- Correo o contraseña incorrectos dan siempre la misma respuesta (`invalid_credentials`), exista o no el correo.
- **Google** verifica firma, vencimiento, emisor y que el token se emitió para nuestro `GOOGLE_CLIENT_ID`. **Nunca crea cuentas**: los negocios los da de alta la plataforma, así que el dueño ya existe. Exige correo verificado por Google; la primera vez enlaza el id de Google al usuario y desde entonces se identifica por ese id. Otra cuenta de Google no puede apropiarse de un usuario ya enlazado.
- Límites de intentos: login 20/min por dirección y 5/min por correo (así no se reparten las pruebas de contraseña de una cuenta entre muchas direcciones), Google 20/min, refresh 60/min.
- El correo se compara sin distinguir mayúsculas, incluido el login del admin.

### API del panel del negocio (M5)

Cada petición actúa sobre **un** negocio del usuario: automático si tiene uno, o el indicado en la cabecera `X-Business` (su slug) si tiene varios. Todas las consultas filtran por ese negocio; un negocio ajeno responde igual que uno inexistente. Un negocio suspendido sigue accesible para su dueño.

| Ruta | Qué hace | Quién |
|---|---|---|
| `GET /panel/business/` | El negocio y el valor efectivo de cada opción | Miembros |
| `GET /panel/bookings/` | Reservas con filtros (estado, recurso, fechas locales, texto) y paginación | Miembros |
| `POST /panel/bookings/` | Registra una reserva tomada por teléfono o WhatsApp | Miembros |
| `GET /panel/bookings/{id}/` | Detalle con historial de estados | Miembros |
| `POST /panel/bookings/{id}/confirm/ reject/ cancel/ complete/ no-show/` | Cambios de estado | Miembros |
| `GET /panel/customers/`, `GET` y `PATCH /panel/customers/{id}/` | Fichas de clientes, nombre, correo y bloqueo | Miembros |
| `GET /panel/blocks/` | Bloqueos de horario | Miembros |
| `POST /panel/blocks/`, `DELETE /panel/blocks/{id}/` | Crear y quitar bloqueos | Solo el dueño |

Los errores de reglas siguen el formato `{"code", "detail"}`: `invalid_transition`, `booking_expired`, `not_started_yet`, `slot_unavailable`, `slot_blocked`, `slot_in_past`.

Pendiente de esta parte: gestión de recursos, servicios, horarios semanales, perfil público y opciones (ver el plan).

### Documentación interactiva y salud

La API se documenta sola con drf-spectacular (OpenAPI 3): cada endpoint nuevo aparece en la lista sin escribir nada aparte.

| Ruta | Contenido |
|---|---|
| `/api/docs/` | Lista de endpoints interactiva (Swagger UI) |
| `/api/redoc/` | La misma documentación en formato de lectura |
| `/api/schema/` | Esquema OpenAPI en bruto |
| `/api/health/` | Estado de la API y de la base de datos; devuelve 503 si la base no responde |

La documentación está **activa en desarrollo y desactivada en producción** por defecto (se activa con `API_DOCS_ENABLED=1`). Todo endpoint exige autenticación salvo que declare lo contrario.

## 6. Estructura del repositorio

```
reservasApp/
  docs/
  backend/
    config/            ajustes del proyecto
    apps/
      businesses/      negocio, suscripción, configuración y plantillas
      catalog/         recursos, servicios
      core/            endpoint de salud y utilidades compartidas
      api/public/      API pública de reservas (serializadores, vistas, rutas)
      availability/    reglas, bloqueos, cálculo de horarios libres
      bookings/        reserva, estados, expiración
      customers/       clientes y bloqueos
      notifications/   correo y enlaces de WhatsApp (interfaz reemplazable)
      accounts/        usuarios y acceso
  frontend/
    src/
      public/          flujo de reserva del cliente
      panel/           panel del negocio
```

## 7. Hosting con herramientas gratuitas

El objetivo es gastar lo mínimo. Los planes gratuitos cambian con frecuencia y las fuentes consultadas (blogs de terceros, octubre de 2026) se contradicen en detalles, así que **todo esto debe confirmarse en las páginas oficiales antes de elegir**.

| Pieza | Candidatos | Observaciones |
|---|---|---|
| Frontend | [Cloudflare Pages](https://dev.to/build996/vercel-vs-netlify-vs-cloudflare-pages-free-frontend-hosting-compared-3h9g) o Netlify | Permiten uso comercial en el plan gratuito. **Evitar Vercel Hobby**: su plan gratuito es solo no comercial |
| Base de datos | [Neon o Supabase](https://flaviocopes.com/database-hosting-options/) | Ambos tienen plan gratuito con límites de almacenamiento y de inactividad (Supabase pausa proyectos inactivos). **No pude confirmar que ofrezcan `btree_gist`**, y es obligatorio |
| Backend | [Render, PythonAnywhere u otros](https://appliku.com/post/free-django-hosting/) | Render gratuito se duerme tras un tiempo sin uso y tarda de 30 a 60 segundos en despertar. Railway y Fly.io no tienen plan gratuito permanente |

**Riesgo principal:** un sistema de reservas que tarda un minuto en abrir, o cuya base de datos se pausa, pierde clientes del negocio. Mi recomendación por fases:

1. **Desarrollo y demostraciones:** todo gratuito, sin problema.
2. **Piloto con un negocio real:** presupuestar un backend que no se duerma. Suele costar unos pocos dólares al mes, según las fuentes consultadas.
3. **Antes de elegir proveedor de base de datos:** probar que `btree_gist` funcione creando la restricción en una base de prueba.

## 8. Decisiones de arquitectura propuestas

| # | Decisión |
|---|---|
| A1 | Monolito modular con Django y DRF |
| A2 | PostgreSQL con restricción de exclusión para impedir solapamientos |
| A3 | Multi-tenancy por columna `business_id` en un solo esquema |
| A4 | Configuración en JSON validado con herencia servicio → negocio → plataforma, y plantillas por rubro |
| A5 | Disponibilidad calculada, no almacenada |
| A6 | Frontend React con Vite y TypeScript como PWA |
| A7 | Expiración correcta sin cron (al consultar y al crear), con cron opcional |
| A8 | Panel de superadmin con el admin de Django en el MVP |
| A9 | Monorepo; documentación en español, código en inglés |

## 9. Preguntas abiertas

1. **Proveedor de hosting concreto.** Falta decidir y probar `btree_gist` (ver sección 7).
2. **Dominio.** ¿Subdominio por negocio o ruta (`app.pe/negocio`)? La ruta es más simple y no requiere configuración de DNS por negocio.
3. **Nombre del producto**, que define el dominio.
