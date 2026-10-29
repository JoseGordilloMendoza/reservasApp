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
- **RN-09.** El negocio puede crear reservas manuales (las que le piden por teléfono o WhatsApp), que nacen confirmadas. Pueden quedar fuera del horario de atención y de los límites de anticipación, no respetan el descanso entre reservas, y se permiten para un cliente bloqueado o que llegó al tope: decide el dueño. Aun así no pueden solaparse con otra reserva ni con un bloqueo, ni estar enteramente en el pasado.
- **RN-09b.** El negocio puede confirmar, rechazar o cancelar una reserva en cualquier momento (sin el plazo de anticipación del cliente), y marcarla como atendida o como "no asistió" una vez que empezó. Una reserva pendiente vencida no se puede confirmar ni rechazar.
- **RN-10.** El precio mostrado es **referencial**: la plataforma no cobra. Cada reserva conserva el precio vigente al crearla (RS-05).

## Cancelación

- **RN-11.** El cliente puede cancelar con su link una reserva **confirmada** si falta al menos la anticipación configurada. *Por defecto: 24 horas (12 en canchas).* Una reserva **pendiente** puede cancelarse siempre mientras siga pendiente: todavía no es un compromiso del negocio y se libera sola al vencer su bloqueo.
- **RN-12.** Pasado ese plazo, el cliente no puede cancelar por su cuenta una reserva confirmada y debe contactar al negocio. Una reserva ya vencida, cancelada o atendida no se puede cancelar.
- **RN-13.** El negocio puede cancelar una reserva en cualquier momento.
- **RN-14.** Cancelar una reserva libera el horario inmediatamente.

## Cliente

- **RN-15.** El cliente se identifica por su **celular** dentro de cada negocio, normalizado al formato internacional (`+51...`). Un mismo celular en dos negocios son dos clientes distintos en cada uno.
- **RN-15b.** Los celulares peruanos se aceptan como `987654321`, `51987654321` o `+51 987 654 321` y se guardan como `+51987654321`. Los números de otros países deben empezar con `+` y llevar el código de país.
- **RN-16.** Un cliente bloqueado no puede crear reservas en ese negocio. El mensaje que ve es genérico ("no es posible completar la reserva, contacta al negocio") y no revela que fue bloqueado.
- **RN-16b.** Un cliente puede tener como máximo 3 reservas activas (pendientes o confirmadas, que aún no terminaron) por negocio. El límite es configurable por negocio (`max_active_bookings_per_customer`).
- **RN-17.** El link de gestión da acceso solo a esa reserva.

## Suscripción

- **RN-18.** Un negocio suspendido, o con la suscripción vencida más allá de sus días de gracia, no ofrece horarios ni recibe reservas nuevas. Su página pública no desaparece: explica que no está recibiendo reservas por ahora y deja contactarlo. Sus reservas ya hechas se conservan, los boletos de sus clientes siguen funcionando y su dueño puede entrar al panel.
- **RN-19.** Suspender un negocio no borra ningún dato.
- **RN-40.** La suscripción tiene plan, precio mensual acordado y la fecha hasta la que vale (inclusive, en el calendario del propio negocio). Un negocio sin suscripción registrada no vence nunca.
- **RN-41.** Al vencer hay **5 días de gracia**: sigue recibiendo reservas y su panel avisa hasta cuándo. Pasados, se comporta como suspendido. Se calcula al consultar, sin tarea programada.
- **RN-42.** Cada pago recibido (Yape, Plin, transferencia, efectivo) se registra con los meses que cubre. Si el negocio sigue al día, los meses nuevos continúan desde el final actual; si ya había vencido, empiezan el día del pago. Un pago no se edita: un error se corrige moviendo la vigencia, con un motivo.
- **RN-43.** Suspender exige un motivo y no depende de la suscripción: un negocio suspendido a mano sigue suspendido aunque pague, hasta que se reactive. Reactivar no reabre a un negocio con la suscripción vencida.
- **RN-44.** Un negocio nunca se queda sin dueño: no se puede quitar ni bajar de rol al último.
- **RN-45.** El equipo de la plataforma solo entra al panel de un negocio con una sesión de soporte: tiene motivo, dura 2 horas, se puede terminar antes y es personal. Mientras dura, el panel lo dice con una barra fija. Quedan registrados su inicio, su fin y cada cambio hecho (método y dirección, nunca el contenido).
- **RN-46.** Todo lo que hace el equipo sobre un negocio (altas, cambios, suspensiones, pagos, ajustes de vigencia, personas y soporte) queda en un registro que no se edita y que sobrevive aunque se borre el negocio o la persona.

## Acceso

- **RN-20.** Los usuarios del panel son dados de alta por la plataforma junto con su negocio. Entran con correo y contraseña o con su cuenta de Google; Google nunca crea cuentas nuevas.
- **RN-21.** El correo no distingue mayúsculas. Un correo o una contraseña incorrectos dan la misma respuesta, para no revelar qué correos existen.
- **RN-22.** Los intentos de acceso están limitados por dirección y por correo. Superado el límite, ni la contraseña correcta entra hasta que pase el minuto.
- **RN-23.** La sesión dura mientras se renueve: el acceso vence a los 15 minutos y la renovación a los 7 días. Cada renovación invalida la anterior, y cerrar sesión la invalida del todo.
- **RN-24.** Un usuario actúa sobre un solo negocio por petición. Si pertenece a varios, indica cuál. Nunca ve ni modifica datos de otro negocio.
- **RN-25.** Quien pertenece a un negocio, sea dueño o personal, puede operar todo el panel: reservas, clientes y bloqueos (y, cuando exista, la configuración). Los negocios son pequeños y quien atiende lo hace todo. La diferencia entre dueño y personal se reserva para lo que afecte a la cuenta, como gestionar usuarios o la suscripción.
- **RN-26.** Un dueño de un negocio suspendido sigue pudiendo entrar a consultar sus datos.
- **RN-27.** El teléfono de un cliente identifica a la persona en ese negocio y no se puede cambiar; sí su nombre y correo, y se puede bloquear.
- **RN-39.** Quien olvidó su contraseña pide un enlace por correo. La respuesta es la misma y llega igual de rápido exista o no la cuenta, para no revelar quién está registrado. El enlace sirve una sola vez y vale una hora; al usarlo se cierran las sesiones abiertas. Una cuenta que solo entra con Google también puede fijar una contraseña así. Los pedidos están limitados por dirección y por correo.

## Avisos por correo

- **RN-34.** Cuando un cliente reserva en línea, todos los usuarios activos del negocio reciben un correo con los datos de la reserva y, si está pendiente, hasta cuándo se mantiene el horario. Cuando el cliente cancela, también se les avisa.
- **RN-35.** Si el cliente dejó su correo, recibe un correo al reservar (pendiente o confirmada), cuando el negocio confirma, rechaza o cancela, y cuando el horario vence sin respuesta. Sin correo no se le escribe; el botón de WhatsApp sigue disponible.
- **RN-36.** Solo el primer correo al cliente trae el enlace a su boleto, porque ese enlace se genera una vez y no se puede reconstruir. Los siguientes traen los datos de la reserva y cómo contactar al negocio.
- **RN-37.** Un correo que falla no impide, no deshace ni retrasa la reserva ni su cambio de estado. El fallo se registra. Los avisos salen una vez que el cambio quedó guardado, nunca antes.
- **RN-38.** Las reservas que anota el propio negocio solo avisan al cliente (si dejó su correo); el negocio ya lo sabe.

## Configuración del negocio

- **RN-28.** El negocio edita su nombre, descripción, dirección, teléfono, WhatsApp y opciones. Su link, tipo, zona horaria y estado los fija la plataforma.
- **RN-29.** Las opciones se cambian de una en una: solo se modifican las que se envían, y si una es inválida no se cambia ninguna.
- **RN-30.** Un recurso o servicio que ya tiene reservas no se borra: se desactiva, y deja de ofrecerse sin afectar las reservas hechas. Sin reservas sí se puede borrar.
- **RN-31.** Cambiar el precio o la duración de un servicio, o el horario de un recurso, no altera las reservas ya hechas.
- **RN-32.** El nombre de un recurso es único dentro del negocio. Un servicio pertenece a un solo recurso y no se mueve a otro.
- **RN-33.** El horario semanal tiene varias ventanas por día que no se solapan; un horario sin ventanas deja el recurso cerrado.

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

- ¿Qué pasa con las reservas ya confirmadas cuando un negocio se suspende por impago?
- ¿Se permite que el cliente reserve varios bloques seguidos en una sola operación?
