# 06 - Reglas de negocio

> Borrador v0.1. Los valores numéricos son **valores por defecto propuestos** y todos se pueden cambiar por negocio.

## Disponibilidad

- **RN-01.** La disponibilidad se calcula a partir del horario semanal del recurso, menos los bloqueos y las reservas activas (pendientes y confirmadas).
- **RN-02.** Un horario se ofrece si cumple la anticipación mínima y el horizonte máximo configurados. *Por defecto: reservar con al menos 1 hora de anticipación y hasta 30 días adelante.*
- **RN-03.** Los inicios posibles siguen el intervalo configurado (cada 30 min o cada hora), contado desde el inicio de cada bloque de atención (si abre a las 18:30 con intervalo de 1 h, los inicios son 18:30, 19:30...). Una reserva debe terminar antes de que cierre el bloque. Se respeta el descanso entre reservas si existe; el descanso aplica alrededor de otras reservas, no alrededor de bloqueos.
- **RN-03b.** Un horario que termina a las 00:00 significa "hasta la medianoche", y 00:00 a 00:00 significa "abierto todo el día". Las horas después de medianoche se registran como un segundo horario del día siguiente; una reserva puede cruzar la medianoche si ambos horarios se tocan.
- **RN-03c.** El horizonte cuenta días calendario en la zona horaria del negocio: con 30 días, se ofrece hasta el día 30 contado desde hoy.
- **RN-04.** Un bloqueo creado sobre un horario con reservas existentes **no las cancela**; la aplicación avisa al negocio de los conflictos para que decida.

## Reserva

- **RN-05.** Dos reservas activas no pueden solaparse en el mismo recurso. Si dos clientes reservan el mismo horario a la vez, gana uno y el otro recibe un aviso para elegir otro horario.
- **RN-06.** Con confirmación **automática**, la reserva nace confirmada. Con confirmación **manual**, nace pendiente.
- **RN-07.** Una reserva pendiente bloquea el horario hasta su fecha de expiración. *Por defecto: 2 horas, o hasta 30 minutos antes del inicio si eso ocurre antes.*
- **RN-08.** Una reserva pendiente que vence pasa a **expirada** y libera el horario. Una reserva expirada no se puede confirmar; el negocio puede crear una nueva.
- **RN-09.** El negocio puede crear reservas manuales, que nacen confirmadas.
- **RN-10.** El precio mostrado es **referencial**: la plataforma no cobra. Cada reserva conserva el precio vigente al crearla (RS-05).

## Cancelación

- **RN-11.** El cliente puede cancelar con su link si falta al menos la anticipación configurada. *Por defecto: 24 horas.*
- **RN-12.** Pasado ese plazo, el cliente no puede cancelar por su cuenta y debe contactar al negocio.
- **RN-13.** El negocio puede cancelar una reserva en cualquier momento.
- **RN-14.** Cancelar una reserva libera el horario inmediatamente.

## Cliente

- **RN-15.** El cliente se identifica por su **celular** dentro de cada negocio, normalizado al formato internacional (`+51...`). Un mismo celular en dos negocios son dos clientes distintos en cada uno.
- **RN-16.** Un cliente bloqueado no puede crear reservas en ese negocio.
- **RN-17.** El link de gestión da acceso solo a esa reserva.

## Suscripción

- **RN-18.** Un negocio con suscripción vencida o suspendido no muestra su página pública ni recibe reservas nuevas. Sus reservas ya confirmadas se conservan y su dueño puede entrar al panel para consultarlas.
- **RN-19.** Suspender un negocio no borra ningún dato.

## Plantillas de rubro

Cada rubro tiene necesidades distintas, así que al crear un negocio se elige una plantilla que precarga los valores. Después el negocio los ajusta libremente (CF-09). Los valores de las columnas son **iniciales y deben validarse con negocios reales**.

| Valor | Valores generales | Cancha | Psicólogo |
|---|---|---|---|
| Duración del servicio | 60 min | 60 min | 50 min |
| Intervalo entre inicios | 60 min | 60 min | 60 min |
| Descanso entre reservas | 0 min | 0 min | 10 min |
| Confirmación | manual | manual | manual |
| Bloqueo de una reserva pendiente | 2 h | 2 h | 12 h |
| Anticipación para cancelar | 24 h | 12 h | 24 h |
| Anticipación mínima para reservar | 1 h | 1 h | 12 h |
| Horizonte de reserva | 30 días | 30 días | 30 días |

Los valores de la columna **Valores generales** son los de las reglas RN-02, RN-07 y RN-11.

**Implementado** en `backend/apps/businesses/presets.py`. Al crear un negocio se copian todos los valores de su plantilla; el negocio queda con su propia copia. La duración del servicio no es una opción del negocio: es el valor sugerido al crear un servicio nuevo. En el código los tiempos se guardan en minutos (por ejemplo, 24 h = `1440`); ver [07-arquitectura.md](07-arquitectura.md).

## Pendiente de decidir

- ¿Cuántas reservas activas puede tener un mismo celular a la vez? Limitarlo ayuda contra el abuso.
- ¿Qué pasa con las reservas ya confirmadas cuando un negocio se suspende por impago?
- ¿Se permite que el cliente reserve varios bloques seguidos en una sola operación?
