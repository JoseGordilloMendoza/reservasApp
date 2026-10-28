# 04 - Glosario

La documentación usa español y el código usa inglés. La columna **En el código** indica el nombre técnico.

| Término | En el código | Definición |
|---|---|---|
| **Plataforma** | - | El sistema completo que operamos nosotros |
| **Negocio / tenant** | `Business` | Cliente de la plataforma que recibe reservas (un complejo de canchas, un consultorio) |
| **Cliente final** | `Customer` | Persona que hace una reserva en un negocio |
| **Usuario** | `User` | Persona que entra al panel (dueño del negocio o, después, su personal) |
| **Superadmin** | superuser | Usuario del equipo de la plataforma que administra negocios y suscripciones |
| **Recurso** | `Resource` | Lo que se reserva: una cancha, un profesional |
| **Servicio** | `Service` | Tipo de reserva de un negocio, con su duración y reglas (por ejemplo "alquiler 1 hora" o "sesión 50 min") |
| **Disponibilidad** | `AvailabilityRule` | Horario semanal en el que un recurso puede reservarse |
| **Bloqueo** | `Block` | Horario que el negocio cierra manualmente (mantenimiento, feriado, uso propio) |
| **Reserva** | `Booking` | Registro de un cliente final en un recurso y horario, con un estado |
| **Pendiente** | `pending` | Reserva creada que aún no se confirma y que bloquea el horario por un tiempo limitado |
| **Confirmada** | `confirmed` | Reserva aprobada por el negocio o automáticamente |
| **Completada** | `completed` | Reserva ya atendida |
| **Cancelada** | `cancelled` | Reserva anulada por el cliente o el negocio |
| **Expirada** | `expired` | Reserva pendiente que venció sin confirmarse |
| **No asistió** | `no_show` | El cliente no se presentó |
| **Confirmación automática / manual** | `settings` | Si la reserva se confirma sola o el negocio la aprueba |
| **Política de cancelación** | `settings` | Anticipación mínima con la que el cliente puede cancelar |
| **Plantilla de rubro** | `business_type` | Conjunto de valores iniciales según el tipo de negocio (cancha, psicólogo) |
| **Reserva recurrente** | `series_id` | Reserva que se repite (por ejemplo, todos los martes a las 19:00) |
| **Suscripción** | `Subscription` | Pago periódico del negocio por usar la plataforma |
| **Link del negocio** | `slug` | Dirección pública propia del negocio, donde sus clientes reservan |
| **Link de gestión** | `manage_token` | Dirección única que permite al cliente ver o cancelar su reserva sin cuenta |
