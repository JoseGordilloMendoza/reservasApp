# 05 - Requisitos

> Borrador v0.1. Prioridad: **MVP** entra en la primera versión; **Después** queda fuera, pero el diseño no debe impedirlo.

## 1. Requisitos funcionales

### Superadmin (SA)

| ID | Requisito | Prioridad |
|---|---|---|
| SA-01 | Crear un negocio con su dueño, su link público (slug único) y una plantilla de rubro | MVP |
| SA-02 | Ver el listado de negocios con su estado de suscripción | MVP |
| SA-03 | Registrar plan, precio acordado, fecha de inicio y vigencia de la suscripción | MVP |
| SA-04 | Suspender y reactivar un negocio (una suspensión desactiva su página pública y no borra datos) | MVP |
| SA-05 | Ingresar como soporte al panel de un negocio, con registro de auditoría | Después |
| SA-06 | Registro de pagos de suscripción e historial | Después |
| SA-07 | Alta de negocios por autoservicio (el negocio se registra solo) | Después |

### Negocio (NG)

| ID | Requisito | Prioridad |
|---|---|---|
| NG-01 | Iniciar sesión con email y contraseña, y recuperar la contraseña | MVP |
| NG-02 | Editar el perfil público: nombre, descripción, dirección, teléfono, WhatsApp, imágenes | MVP |
| NG-03 | Gestionar recursos (crear, editar, desactivar) | MVP |
| NG-04 | Gestionar servicios o tipos de reserva por recurso: nombre, duración, precio referencial | MVP |
| NG-05 | Definir horarios semanales de atención por recurso | MVP |
| NG-06 | Bloquear horarios o días (mantenimiento, feriados, uso propio) | MVP |
| NG-07 | Ver las reservas en vista de calendario y de lista, con filtros por recurso, fecha y estado | MVP |
| NG-08 | Confirmar, rechazar y cancelar reservas | MVP |
| NG-09 | Crear una reserva manual (cliente que llamó o escribió por WhatsApp) | MVP |
| NG-10 | Marcar una reserva como completada o como "no asistió" | MVP |
| NG-11 | Ver la ficha de un cliente: datos e historial de reservas en ese negocio | MVP |
| NG-12 | Bloquear a un cliente por número de celular | MVP |
| NG-13 | Varios usuarios por negocio con roles (dueño, staff) | Después |
| NG-14 | Reservas recurrentes (serie semanal) | Después |
| NG-15 | Reportes de ocupación e ingresos referenciales | Después |

### Configuración (CF)

Cada valor tiene un **valor por defecto de la plataforma**, se ajusta por negocio y, cuando aplique, se puede sobrescribir por servicio.

| ID | Requisito | Prioridad |
|---|---|---|
| CF-01 | Duración de bloque o servicio, fija o con varias opciones | MVP |
| CF-02 | Modo de confirmación: automática o manual | MVP |
| CF-03 | Tiempo que una reserva pendiente bloquea el horario antes de expirar | MVP |
| CF-04 | Anticipación mínima para cancelar | MVP |
| CF-05 | Anticipación mínima para reservar y horizonte máximo (hasta cuántos días adelante) | MVP |
| CF-06 | Intervalo entre inicios de reserva (cada 30 min, cada hora) y tiempo de descanso entre reservas | MVP |
| CF-07 | Campos adicionales que se piden al cliente (por ejemplo, motivo o cantidad de personas) | Después |
| CF-08 | Textos de mensajes y de la política mostrada al cliente | Después |
| CF-09 | Plantillas de rubro (cancha, psicólogo) que precargan los valores iniciales al crear un negocio; el negocio puede cambiar cualquiera | MVP |

### Cliente final (CL)

| ID | Requisito | Prioridad |
|---|---|---|
| CL-01 | Ver la página pública del negocio: datos, recursos y servicios | MVP |
| CL-02 | Ver horarios disponibles por recurso y fecha | MVP |
| CL-03 | Reservar indicando nombre y celular, sin cuenta | MVP |
| CL-04 | Ver el resultado de la reserva (pendiente o confirmada) y cómo continuar con el negocio | MVP |
| CL-05 | Consultar y cancelar su reserva mediante un link único | MVP |
| CL-06 | Contactar al negocio por WhatsApp con un mensaje prellenado | MVP |
| CL-07 | Reprogramar su reserva por su cuenta | Después |
| CL-08 | Aceptar términos y política de privacidad al reservar | MVP |

### Reservas (RS)

| ID | Requisito | Prioridad |
|---|---|---|
| RS-01 | Una reserva pasa por estados: pendiente, confirmada, completada, cancelada, expirada, no asistió | MVP |
| RS-02 | Nunca puede haber dos reservas activas solapadas en el mismo recurso, incluso con solicitudes simultáneas | MVP |
| RS-03 | Las reservas pendientes que vencen pasan a expiradas y liberan el horario | MVP |
| RS-04 | Cada cambio de estado se registra con fecha y autor | MVP |
| RS-05 | Una reserva guarda el precio y la duración vigentes al momento de crearla | MVP |

### Notificaciones (NT)

| ID | Requisito | Prioridad |
|---|---|---|
| NT-01 | Email al negocio cuando llega una reserva | MVP |
| NT-02 | Email al cliente, si dio email, con el estado de su reserva | MVP |
| NT-03 | Botón de WhatsApp con mensaje prellenado para negocio y cliente | MVP |
| NT-04 | Notificación push web al panel del negocio | Después |
| NT-05 | Recordatorios automáticos antes de la reserva | Después |
| NT-06 | WhatsApp oficial con envío automático | Después |

## 2. Requisitos no funcionales

| ID | Categoría | Requisito |
|---|---|---|
| NF-01 | Integridad | La base de datos impide por sí misma las reservas solapadas; no se confía solo en el código de la aplicación |
| NF-02 | Aislamiento | Un negocio nunca puede ver ni modificar datos de otro; hay pruebas automáticas que lo verifican |
| NF-03 | Zona horaria | Todo se guarda en UTC y se muestra en `America/Lima` |
| NF-04 | Rendimiento | Consultar disponibilidad de un recurso para un día responde en menos de 500 ms con carga normal |
| NF-05 | Uso móvil | La reserva del cliente funciona bien en un celular con conexión lenta; el diseño parte del móvil |
| NF-06 | Seguridad | Contraseñas con hash robusto, HTTPS obligatorio, límite de intentos de acceso y límite de solicitudes en el flujo público |
| NF-07 | Link de gestión | Token aleatorio no adivinable; en la base de datos solo se guarda su hash |
| NF-08 | Privacidad | Solo se guardan los datos necesarios. Revisar la Ley 29733 de Protección de Datos Personales con asesoría legal |
| NF-09 | Flexibilidad | Lo que cambia entre negocios se resuelve con configuración y no con cambios de código |
| NF-10 | Disponibilidad | Objetivo inicial razonable: 99 % mensual, sin alta disponibilidad redundante |
| NF-11 | Respaldo | Copias de seguridad diarias de la base de datos, y se prueba restaurar al menos una vez |
| NF-12 | Costo | Operación inicial con un costo mensual bajo; sin servicios con cobro por mensaje o por usuario |
| NF-13 | Idioma | Interfaz en español de Perú; textos preparados para otros idiomas |
| NF-14 | Observabilidad | Registro de errores y de eventos clave (reservas creadas, expiradas, fallos de correo) |
| NF-15 | Mantenibilidad | Pruebas automáticas para las reglas de reserva, la disponibilidad y el aislamiento entre negocios |
