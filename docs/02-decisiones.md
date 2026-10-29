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
| D37 | Roles `owner` y `staff` en la pertenencia usuario-negocio, con los mismos permisos en el panel; la diferencia se reserva para gestionar usuarios y suscripción | Tomada | Negocios pequeños: quien opera lo hace todo. El rol queda listo para cuando haya más personas |
| D38 | Un usuario con varios negocios indica cuál con la cabecera `X-Business` | Tomada | Simple y sin estado en el servidor |
| D39 | Una reserva manual del dueño puede salirse del horario y del tope, pero no solaparse con reservas ni bloqueos | Tomada | El dueño decide, la integridad se mantiene |
| D40 | Crear un bloqueo no cancela reservas; se avisan las que quedan en conflicto | Tomada | Ya estaba en RN-04 |
| D41 | La recuperación de contraseña se hace en M8, junto con el correo | Tomada | Necesita el envío de correos |
| D42 | El horario semanal de un recurso se lee y se reemplaza completo en una sola llamada (`PUT`) | Tomada | Encaja con una pantalla de configuración y es atómico |
| D43 | Un recurso o servicio con reservas no se borra, se desactiva | Tomada | Conserva el historial; ya lo garantiza la base de datos |
| D44 | Las opciones del negocio se fusionan al editar (solo cambian las enviadas) | Tomada | Evita pisar opciones que la pantalla no mostró |
| D45 | El link, tipo, zona horaria y estado del negocio no los edita el negocio | Tomada | El link es la dirección pública; el estado depende de la suscripción |
| D46 | Las imágenes del negocio quedan fuera del MVP | Propuesta | Necesitan almacenamiento de archivos, que sumaría costo y complejidad |
| D47 | Dirección visual del frontend: **boleto neobrutalista** (bordes gruesos, sombras duras, bloques de color; la reserva es un boleto) | Tomada | Elegida entre tres opciones; se sostiene sin fotos. Ver [09-diseno-frontend.md](09-diseno-frontend.md) |
| D48 | Cada negocio elige su **color de acento** entre cinco (lime, tangerine, cobalt, rose, mint) | Tomada | Una estructura reconocible y una página distinta por negocio |
| D49 | Nombre de trabajo **Separa**, centralizado en un solo archivo | Propuesta | Hasta decidir el nombre definitivo (Q4) |
| D50 | El horario más cercano llega ya elegido; los datos del cliente se piden después de elegir horario | Tomada | Menos pasos, según la investigación de selectores de fecha y hora |
| D51 | Los boletos del cliente se guardan en su dispositivo ("Mis reservas") | Tomada | No hay cuentas de cliente |
| D52 | Frontend instalable (PWA); solo se guarda en caché la propia aplicación, nunca la API | Tomada | Las reservas y la disponibilidad deben venir siempre del servidor |
| D53 | En desarrollo el frontend reenvía `/api` al backend; en producción se usa CORS con una lista de orígenes | Tomada | Sin configuración extra al desarrollar, y seguro al publicar |
| D54 | El tema (claro u oscuro) sigue al sistema y se puede forzar con `data-theme` | Tomada | Modo oscuro obligatorio sin añadir un botón por ahora |
| D55 | El panel se diseña primero para el celular del dueño (pestañas abajo), con barra lateral en pantallas grandes | Propuesta | El dueño atiende de pie; supuesto a confirmar con negocios reales |
| D56 | Al entrar, el dueño ve primero lo urgente: reservas por confirmar y las de hoy | Propuesta | Es lo que requiere acción; un calendario completo puede agregarse después |
| D57 | El token de acceso vive solo en memoria y el de renovación en el dispositivo; la renovación se comparte entre peticiones simultáneas | Tomada | Un token de renovación en `localStorage` es accesible si hubiera una falla XSS; se acepta en el MVP porque dura poco, rota en cada uso y React escapa lo que muestra. Pasarlo a una cookie `HttpOnly` requeriría cambiar el backend |
| D58 | Las acciones que no se pueden deshacer (rechazar, cancelar) piden confirmación | Tomada | Evita errores con el dedo en un celular |
| D59 | El panel se entrega por tramos: reservas primero; clientes, bloqueos y ajustes después | Tomada | La parte más usada llega antes. Cumplida: los tres tramos están hechos |
| D60 | En el celular el panel tiene cuatro pestañas (Inicio, Anotar, Reservas, Más); clientes, bloqueos y ajustes viven en "Más", y en pantallas grandes todo va en la barra lateral | Tomada | Cuatro pestañas caben con botones grandes; lo menos frecuente no necesita una pestaña fija |
| D61 | En la interfaz el recurso se llama **espacio** (cancha, consultorio o persona) | Tomada | "Recurso" es un término técnico; "espacio" sirve para canchas y para psicólogos |
| D62 | Un bloqueo de todo el día cubre desde la medianoche del primer día hasta la medianoche posterior al último; el horario semanal acepta 00:00 como medianoche | Tomada | Coincide con las reglas del servidor (D42) y evita huecos o solapes al cruzar el día |
| D63 | Las acciones destructivas de ajustes (desactivar, eliminar) piden confirmación; un espacio o servicio con reservas solo se desactiva (D43) | Tomada | Coherente con D58; el mensaje explica por qué no se puede eliminar |
| D64 | El aviso de una reserva nueva llega por correo a **todos los usuarios del negocio** (dueño y personal); el negocio no tiene un correo propio | Tomada | No exige configurar nada y nadie depende de que una sola persona mire su correo. Si hace falta, un correo elegido en Ajustes se agrega después |
| D65 | El cliente, si dejó su correo, recibe correos solo por **cambios de estado**: al reservar (pendiente o confirmada), cuando el negocio confirma, rechaza o cancela, y cuando el horario vence sin respuesta | Tomada | Es lo que NT-02 pide. Los recordatorios (NT-05) necesitan una tarea programada y quedan para después |
| D66 | Solo el primer correo al cliente lleva el enlace a su boleto; los siguientes llevan los datos de la reserva y el contacto del negocio | Tomada | El enlace se genera una vez y la base guarda solo su hash (NF-07), así que no se puede reconstruir después |
| D67 | El correo se envía con el sistema estándar de Django, configurado por variables de entorno: en desarrollo se imprime en la consola y en producción se conecta cualquier proveedor SMTP | Tomada | La interfaz es reemplazable (arquitectura, principio 4) y no ata a un proveedor antes de decidir el hosting |
| D68 | Un correo que falla **nunca** impide ni deshace la reserva: se registra el fallo (NF-14) y la operación sigue. El envío es síncrono, con un tiempo máximo corto | Tomada | La reserva es lo importante; no hay tareas en segundo plano en el hosting gratuito. Si el envío estorba, se mueve a una cola sin cambiar quién lo pide |
| D69 | Recuperar contraseña: un enlace por correo, de un solo uso y válido por una hora; la respuesta es la misma exista o no el correo; al cambiarla se cierran las sesiones abiertas | Tomada | Mismo criterio que el login (RN-21); un enlace robado no sirve dos veces ni mantiene sesiones viejas |
| D70 | El correo de recuperar contraseña se envía en segundo plano, a diferencia de los de reservas, que van síncronos (D68) | Tomada | Si se enviara dentro de la petición, responder tardaría más cuando la cuenta existe y eso revelaría quién está registrado. Medido: 6 a 7 ms con o sin cuenta. Si el proceso se detiene antes de enviar, la persona pide otro enlace |
| D71 | Proveedor de correo propuesto: **Resend** para empezar (SMTP, el más simple de configurar y bien valorado por desarrolladores), con **Brevo** como reemplazo cuando se supere el límite diario. Ambos exigen un dominio propio verificado | Propuesta | Se cambia de uno a otro solo con variables de entorno. Resend gratis permite 100 correos al día y 3000 al mes; Brevo, 300 al día. Se confirma al llegar a M10, cuando exista el dominio |
| D72 | El equipo de la plataforma usa un **panel propio en `/plataforma`**, dentro de la misma aplicación y con el mismo diseño; el admin de Django queda como respaldo de bajo nivel | Tomada | Pedido del fundador: completo y usable desde el celular. Reemplaza a D5 y a A8 como herramienta de uso diario |
| D73 | La suscripción de un negocio guarda plan, precio acordado y vigencia; cada **pago** registrado (método, referencia, meses) extiende la vigencia solo y deja historial. Un negocio sin suscripción registrada no vence nunca | Tomada | Cobro manual (D4) con historial (SA-06). Lo segundo mantiene funcionando a los negocios anteriores a M9 |
| D74 | Tras vencer la vigencia hay **5 días de gracia** en los que el negocio sigue recibiendo reservas con un aviso en su panel; pasados, se comporta como suspendido (RN-18). Se calcula al consultar, sin tarea programada, con la fecha del propio negocio | Tomada | Margen para que paguen sin cortar reservas de sus clientes. Es una constante de la plataforma, no una opción por negocio |
| D75 | Suspender es una decisión manual con **motivo obligatorio**; reactivar lo quita. Ambos quedan en el registro de actividad | Tomada | Trazabilidad de una acción delicada. No borra datos (RN-19) |
| D76 | El equipo puede **entrar como soporte** al panel de un negocio con los mismos permisos que su dueño. Debe abrir una sesión de soporte (con motivo, válida 2 horas), el panel muestra un aviso fijo y cada acción que cambia datos queda registrada | Tomada | Adelanta SA-05 por pedido del fundador. El registro responde quién entró, cuándo, por qué y qué hizo |
| D77 | El alta de un negocio crea al dueño **sin contraseña** y le envía un correo para elegir la suya, con el mismo mecanismo de recuperar contraseña. El equipo puede reenviar el enlace cuando quiera | Tomada | Nadie inventa ni comparte contraseñas por WhatsApp |
| D78 | Un negocio no operativo (suspendido o vencido más allá de la gracia) muestra al público "este negocio no está recibiendo reservas por ahora"; sus reservas confirmadas se conservan y los boletos de sus clientes siguen funcionando | Tomada | Resuelve Q9 en lo que hoy se puede decidir; reservar varios bloques seguidos sigue abierto |
| D79 | El link (`slug`) de un negocio no se cambia desde el panel de plataforma | Tomada | Cambiarlo rompe los enlaces ya compartidos en WhatsApp e Instagram; si hace falta, se hace a mano con el admin de Django |
| D80 | El inicio de la aplicación ofrece un **buscador por nombre**, solo de los negocios que lo activan en sus ajustes (apagado por defecto), con un mínimo de 2 letras, hasta 8 resultados y límite de solicitudes. No hay lista completa | Tomada | Cierra el callejón de quien llega sin link sin volver la plataforma un marketplace ni exponer negocios que no lo pidieron. Matiza D2: el link propio sigue siendo la entrada principal |
| D81 | El titular del inicio es genérico ("Separa tu hora. Sin llamadas.", con "Canchas, consultorios y más") | Tomada | La plataforma no es solo de canchas |
| D82 | Despliegue: **Cloudflare Pages** (frontend), **Render de pago** (backend, para que no se duerma) y **Neon** (base de datos, con `btree_gist` confirmado en su documentación) | Tomada | Un cliente que abre el link desde WhatsApp no puede esperar un minuto a que despierte el servidor. Concreta D24. Los precios y límites se confirman en las páginas oficiales antes de contratar |

## Preguntas abiertas

| # | Pregunta | Notas |
|---|---|---|
| Q1 | Valores por defecto de cancelación y de bloqueo de pendientes | Dependen del rubro: propuestos como plantillas en [06-reglas-de-negocio.md](06-reglas-de-negocio.md); validar con negocios reales |
| Q3 | Precio de la suscripción | Se conversará con los negocios |
| Q4 | Nombre del producto y dominio | "ReservaloYa" descartado por poco atractivo. Pendiente de elegir; verificar disponibilidad de dominio y marca (INDECOPI). **Bloquea el envío real de correos**: el proveedor necesita un dominio verificado para entregar a cualquier destinatario (D71) |
| Q5 | Piloto: ¿qué negocio de canchas? | Aún sin definir |
| Q6 | Cumplimiento de la Ley de Protección de Datos Personales de Perú | Revisar qué datos se guardan y cómo se informa al cliente |
| Q7 | Hosting | Decidido en D82 (Cloudflare Pages, Render de pago y Neon). Falta confirmar en las páginas oficiales el precio del servicio de Render, la región más cercana a Perú y que la restricción de exclusión funcione en una base de prueba de Neon |
| Q9 | Reservar varios bloques seguidos en una operación (lo de las reservas confirmadas de un negocio suspendido quedó resuelto en D78) | Ver [06-reglas-de-negocio.md](06-reglas-de-negocio.md) |
| Q10 | ID de cliente de Google | Resuelto: configurado en el `.env` local y `http://localhost:5173` autorizado en Google Cloud Console. Google recomienda autorizar también `http://localhost`; falta agregar el dominio real al publicar |
| Q11 | Alta de dueños | Resuelto: basta con el admin de Django para el piloto |
