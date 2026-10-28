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
que se solapen, cuando el estado es pending o confirmed
```

Así, aunque dos solicitudes lleguen al mismo milisegundo, la base de datos rechaza la segunda.

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

### Disponibilidad

Los horarios libres **no se almacenan**: se calculan al consultar, a partir de reglas, bloqueos y reservas. Evita datos desactualizados y facilita las reservas recurrentes más adelante.

## 5. API

API REST en `/api/v1/`, dividida por audiencia:

| Zona | Ejemplo | Autenticación |
|---|---|---|
| Pública | `GET /api/v1/public/{slug}/availability`, `POST /api/v1/public/{slug}/bookings` | Ninguna, con límite de solicitudes |
| Gestión del cliente | `GET` y `DELETE /api/v1/public/bookings/{token}` | Token del link |
| Panel del negocio | `GET /api/v1/panel/bookings` | Sesión del usuario |
| Superadmin | `/admin/` de Django en el MVP | Sesión de superusuario |

## 6. Estructura del repositorio

```
reservasApp/
  docs/
  backend/
    config/            ajustes del proyecto
    apps/
      businesses/      negocio, suscripción, configuración y plantillas
      catalog/         recursos, servicios
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
