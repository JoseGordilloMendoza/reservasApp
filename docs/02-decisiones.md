# 02 - Registro de decisiones

Cada decisión indica su estado: **Tomada**, **Propuesta** (pendiente de confirmar) o **Abierta**.

## Decisiones

| # | Decisión | Estado | Motivo |
|---|---|---|---|
| D1 | Modelo SaaS multi-negocio (multi-tenant) | Tomada | Objetivo del proyecto |
| D2 | Cada negocio tiene su **link propio**; el directorio/marketplace queda para después | Tomada | Evita el problema de atraer demanda; encaja con el uso de WhatsApp e Instagram; es más simple |
| D3 | Ingresos por **suscripción**, acordada con cada negocio | Tomada | Decisión del fundador |
| D4 | Sin pasarela de pagos; cobro de suscripción manual | Tomada | Simplicidad inicial |
| D5 | Panel mínimo de superadmin en lugar de editar la base de datos a mano | Tomada | Menos riesgo en producción con poco esfuerzo |
| D6 | Mercado inicial: Arequipa, Perú; moneda soles | Tomada | Contexto del fundador |
| D7 | Los pagos de reservas ocurren fuera de la plataforma | Tomada | La plataforma solo gestiona reservas |
| D8 | Reservas con estados: pendiente, confirmada, completada, cancelada, expirada, no asistió | Tomada | Permite operar sin pagos en línea y evita reservas falsas |
| D9 | Confirmación **automática o manual**, configurable por negocio | Tomada | Flexibilidad por negocio |
| D10 | Política de cancelación **configurable** con un valor por defecto común en Perú | Tomada | El valor exacto se define después |
| D11 | Duración de bloques y servicios configurable por negocio | Tomada | Flexibilidad por negocio |
| D12 | Clientes finales **sin cuenta** (nombre y celular) con link único para gestionar su reserva | Tomada | Mínima fricción; se endurece si hay abuso |
| D13 | Un negocio tiene uno o más **recursos**; el modelo admite varios usuarios con roles, pero el MVP usa solo el dueño | Tomada | Flexibilidad sin complejidad inicial |
| D14 | Reservas recurrentes: fuera del MVP, modelo preparado | Tomada | Importante para canchas, pero no necesario para validar |
| D15 | Web responsive instalable (PWA) primero; app nativa después si hace falta | Tomada | El cliente entra por link; evita instalar y publicar en tiendas |
| D16 | Notificaciones de bajo costo: email y botón `wa.me`; WhatsApp oficial después | Tomada | Evitar costo por mensaje |
| D17 | Sin videollamada ni modalidad virtual | Tomada | Solo se gestionan reservas |
| D18 | Criterio de éxito del MVP: las reservas funcionan | Tomada | Alcance mínimo |
| D19 | Rubro inicial: canchas deportivas | Tomada | Es el caso más claro y frecuente |
| D20 | Arquitectura: monolito modular con Django, DRF, PostgreSQL y React (PWA); detalle en [07-arquitectura.md](07-arquitectura.md) | Propuesta | Stack conocido por el equipo; PostgreSQL impide reservas solapadas |
| D21 | Un solo repositorio (monorepo) con `backend/`, `frontend/` y `docs/` | Tomada | Documentación y código juntos |
| D22 | Documentación en español; código, API y commits en inglés | Tomada | Convención habitual y facilita herramientas y colaboración |
| D23 | **Plantillas de rubro** que precargan valores según el tipo de negocio (cancha, psicólogo), todos ajustables | Propuesta | Los valores adecuados dependen del negocio; ver [06-reglas-de-negocio.md](06-reglas-de-negocio.md) |
| D24 | Priorizar herramientas gratuitas de hosting; presupuestar un backend que no se duerma al llegar al piloto | Propuesta | Costo bajo sin perjudicar la experiencia de reserva; ver [07-arquitectura.md](07-arquitectura.md), sección 7 |
| D25 | Docker y Docker Compose para el entorno de desarrollo; el despliegue sigue pendiente | Tomada | Entorno reproducible y rápido de levantar |
| D26 | Solo `cancelled` y `expired` liberan el horario; los demás estados lo ocupan | Tomada | El historial tampoco tiene solapamientos; verificado con pruebas |
| D27 | Celulares peruanos de 9 dígitos se normalizan a `+51...`; otros países con `+` | Tomada | Entrada flexible, dato uniforme |
| D28 | Máximo 3 reservas activas por celular y negocio, configurable | Tomada | Freno al abuso sin cuentas |
| D29 | Un cliente bloqueado recibe un mensaje genérico que no revela el bloqueo | Tomada | Evita conflictos y que se esquive cambiando de número |
| D30 | Una reserva pendiente se puede cancelar siempre; el plazo de anticipación aplica solo a las confirmadas | Tomada | La pendiente no es compromiso del negocio y se libera sola. Ajusta RN-11 |
| D31 | Rutas públicas bajo `/api/v1/public/businesses/{slug}/` y `/bookings/{token}/` | Tomada | El nombre de un negocio nunca choca con otras rutas; se reservan nombres como `admin` o `api` |
| D32 | Borrar un recurso, servicio o cliente con reservas está prohibido; un negocio completo sí se puede borrar | Tomada | Protege el historial sin impedir eliminar un negocio |
| D33 | Acceso al panel con **correo y contraseña** y con **Google** | Tomada | Pedido del fundador |
| D34 | Sesiones con tokens JWT (acceso 15 min, renovación 7 días con rotación) | Tomada | El frontend irá en otro dominio que la API |
| D35 | Modelo de usuario propio con el correo como identificador, sin distinguir mayúsculas | Tomada | Se decide ahora porque cambiarlo después es muy costoso |
| D36 | Google solo permite entrar a usuarios existentes; nunca crea cuentas | Tomada | Los negocios los da de alta la plataforma; evita cuentas no autorizadas |
| D37 | Roles `owner` y `staff` en una pertenencia usuario-negocio; el personal no cambia la configuración ni los bloqueos | Propuesta | Permite recepcionistas sin darles control total. El MVP solo usa dueños |
| D38 | Un usuario con varios negocios indica cuál con la cabecera `X-Business` | Tomada | Simple y sin estado en el servidor |
| D39 | Una reserva manual del dueño puede salirse del horario y del tope, pero no solaparse con reservas ni bloqueos | Tomada | El dueño decide, la integridad se mantiene |
| D40 | Crear un bloqueo no cancela reservas; se avisan las que quedan en conflicto | Tomada | Ya estaba en RN-04 |
| D41 | La recuperación de contraseña se hace en M8, junto con el correo | Tomada | Necesita el envío de correos |

## Preguntas abiertas

| # | Pregunta | Notas |
|---|---|---|
| Q1 | Valores por defecto de cancelación y de bloqueo de pendientes | Dependen del rubro: propuestos como plantillas en [06-reglas-de-negocio.md](06-reglas-de-negocio.md); validar con negocios reales |
| Q3 | Precio de la suscripción | Se conversará con los negocios |
| Q4 | Nombre del producto y dominio | "ReservaloYa" descartado por poco atractivo. Pendiente de elegir; verificar disponibilidad de dominio y marca (INDECOPI) |
| Q5 | Piloto: ¿qué negocio de canchas? | Aún sin definir |
| Q6 | Cumplimiento de la Ley de Protección de Datos Personales de Perú | Revisar qué datos se guardan y cómo se informa al cliente |
| Q7 | Proveedor concreto de hosting; confirmar que la base de datos permita la extensión `btree_gist` | Ver [07-arquitectura.md](07-arquitectura.md), sección 7 |
| Q9 | Qué pasa con las reservas confirmadas cuando un negocio se suspende por impago; reservar varios bloques seguidos en una operación | Ver [06-reglas-de-negocio.md](06-reglas-de-negocio.md) |
| Q10 | Crear el ID de cliente de Google (Google Cloud Console) | Hace falta para activar el acceso con Google; ver README |
| Q11 | ¿Los dueños se dan de alta solo desde el admin o hace falta una pantalla de registro? | Hoy se hace desde el admin de Django (SA-01) |
