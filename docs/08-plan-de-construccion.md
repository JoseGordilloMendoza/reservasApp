# 08 - Plan de construcción

> Borrador v0.1. Los hitos se ordenan para **reducir riesgo primero**: lo más delicado (no permitir reservas solapadas) se construye y prueba antes que la interfaz.

El desarrollo corre en contenedores con **Docker Compose** (PostgreSQL y backend). El **despliegue sigue pendiente** (ver [Q7](02-decisiones.md)).

## Hitos

**Avance:** M0 a M9 completados; solo falta M10, el despliegue. El backend tiene 982 pruebas y el frontend 521. El cliente reserva desde el link de su negocio; el dueño gestiona reservas, clientes, bloqueos y ajustes sin usar el admin; recibe correos de aviso y puede recuperar su contraseña; y el equipo de la plataforma abre negocios, cobra suscripciones, suspende y da soporte desde su propio panel.

**M7 (panel en pantalla), completado:**

- Reservas: entrar con correo o Google, inicio con "Por confirmar" y "Hoy" (confirmar y rechazar en un toque), lista con filtros y búsqueda, página de cada reserva con su historial y acciones, y anotar reservas por teléfono con enlace listo para enviar al cliente.
- Clientes: lista con búsqueda y filtro de bloqueados, ficha con historial y bloqueo o desbloqueo.
- Bloqueos: cerrar un espacio o todo el negocio por horas o por días, con aviso de las reservas que ya estaban en ese horario (no se cancelan solas).
- Ajustes: enlace público para copiar, "Mi página" (contacto y color), reglas de reserva, espacios (alta, nombre, activar, eliminar) con su horario semanal, y servicios.
- Pendiente de menor prioridad: opciones propias por servicio (la API las admite; la pantalla usa las del negocio), calendario de día completo y botón manual de modo oscuro.

**Fuera del backend actual:** imágenes del negocio (D46), recuperar contraseña y correos (M8), y el panel de superadmin con suscripciones (M9, hoy basta el admin de Django).

| Hito | Objetivo | Entregables | Listo cuando |
|---|---|---|---|
| **M0. Base del proyecto** | Entorno reproducible | Docker Compose con PostgreSQL y Django, ajustes por variables de entorno, pruebas ejecutables en contenedor | `docker compose up` levanta el backend y `pytest` corre |
| **M1. Reservas sin solapamiento** | Garantizar la integridad desde la base de datos | Modelos de negocio, recurso, servicio, cliente y reserva; restricción de exclusión; admin básico | Las pruebas demuestran que un recurso nunca tiene dos reservas activas solapadas |
| **M2. Configuración y plantillas** | Flexibilidad por negocio | Esquema de `settings` validado, herencia servicio → negocio → plataforma, plantillas de rubro | Un negocio nuevo nace con los valores de su rubro y se pueden cambiar |
| **M3. Disponibilidad** | Calcular horarios libres | Reglas semanales, bloqueos, cálculo de espacios libres respetando anticipación, horizonte e intervalos | Para un recurso y una fecha se obtienen los horarios correctos, con pruebas de casos borde |
| **M4. API pública de reserva** | El cliente puede reservar | Consultar disponibilidad, crear reserva, expiración, link de gestión, cancelación por el cliente, límite de solicitudes | Se puede reservar y cancelar de principio a fin con la API; dos solicitudes simultáneas no duplican el horario |
| **M5. API del panel** | El negocio gestiona sus reservas | Inicio de sesión, aislamiento entre negocios, confirmar, rechazar, cancelar, reservas manuales, bloqueos, clientes | Un negocio opera todo su flujo y nunca ve datos de otro (pruebas de aislamiento) |
| **M6. Frontend público (PWA)** | Pantalla de reserva para el cliente | Página del negocio, selección de horario, formulario, resultado, gestión por link | Una reserva completa desde un celular |
| **M7. Frontend del panel** | Pantalla de gestión | Lista, acciones sobre reservas, clientes, bloqueos, configuración (el calendario queda para después) | El dueño gestiona su negocio sin usar el admin |
| **M8. Notificaciones** | Avisos sin costo | Correo al negocio y al cliente, recuperar contraseña, botones de WhatsApp con mensaje prellenado | Los avisos salen en los eventos clave |
| **M9. Panel de la plataforma** | Operar como SaaS | Panel propio en `/plataforma` (D72): indicadores, alta guiada, suscripción con pagos y vigencia, suspender y reactivar, usuarios, entrar como soporte y registro de actividad | Se da de alta un negocio, se le registra un pago, vence con gracia y se suspende sin perder datos |
| **M10. Despliegue y piloto** | Salir a producción | Imagen de producción, hosting elegido, respaldos, dominio | Un negocio real recibe reservas |

**M9, completado en tres partes**, cada una con sus pruebas:

1. **Suscripción y bloqueo automático:** modelos de suscripción y pagos, vigencia con gracia (D73, D74) y que las páginas públicas y las reservas respeten el vencimiento (RN-18). El dueño ve avisos antes, durante y después del vencimiento.
2. **API de plataforma** bajo `/api/v1/platform/`, solo para el equipo: indicadores, negocios, alta con dueño, suspender, suscripción y pagos, usuarios, sesión de soporte y registro de actividad.
3. **Pantallas de `/plataforma`**: inicio con lo que requiere atención, negocios con filtros, alta guiada, ficha (resumen, suscripción y pagos, personas, soporte, suspensión) y actividad; y la barra de soporte dentro del panel del negocio.

El equipo de ejemplo se crea con `seed_demo` (`equipo@demo.pe` / `demo12345`), y los dos negocios de ejemplo traen suscripciones en estados distintos (uno vigente y otro en gracia) para ver los avisos.

**M10, parte A (hecha):** el código está listo para producción y verificado en una imagen idéntica a la de Render, contra una base vacía.

- `backend/Dockerfile.prod` y `start.sh`: dependencias con versión exacta (`requirements.lock.txt`), estáticos recogidos, usuario sin privilegios; al iniciar migra, crea al administrador (`ensure_platform_admin`, a partir de `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD`) y arranca gunicorn con un solo proceso.
- Ajustes de producción solo con `DEBUG` apagado: HTTPS detrás del proxy (sin bucles, y con la revisión de salud exenta), cookies seguras, HSTS que empieza en una hora, WhiteNoise para los estáticos del admin, hosts desde Render, `NUM_PROXIES` y registros en consola. `check --deploy` no da ninguna advertencia y una prueba lo vigila.
- `render.yaml` para la API en el plan gratuito, sin secretos escritos, y encabezados de caché para Cloudflare Pages.
- Se corrigió de paso el esquema de la API (`/api/docs/`), que tenía nombres repetidos y endpoints sin describir; una prueba exige ahora que se genere sin advertencias.

**M10, parte B (pendiente, con tus cuentas):** seguir [10 - Despliegue de prueba](10-despliegue.md): crear la base en Neon, la API en Render y la aplicación en Cloudflare Pages, y recorrer la lista de comprobaciones. Después, con el nombre y el dominio: correo propio verificado, Google, y el plan de pago de Render.

## Pendiente para M10 (revisado con `check --deploy`)

El backend arranca limpio desde cero con `docker compose up` y sus endpoints responden, pero la imagen actual es de desarrollo. Antes de publicar falta:

- Imagen de producción con servidor de aplicaciones (por ejemplo gunicorn) en lugar de `runserver`, y archivos estáticos del admin.
- Ajustes HTTPS: `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`. Django los marca como advertencias con `DEBUG` apagado.
- `SECRET_KEY` larga y aleatoria como variable de entorno (el sistema ya se niega a arrancar sin ella cuando `DEBUG` está apagado).
- Fijar versiones exactas de las dependencias.
- Decidir si la documentación de la API (`API_DOCS_ENABLED`) se publica.
- **Límite de solicitudes:** hoy usa la memoria de cada proceso. Con varios procesos o servidores cada uno cuenta por separado, así que en producción hace falta un caché compartido (Redis o base de datos). Detrás de un proxy también hay que configurar `NUM_PROXIES` para leer la dirección real del cliente; si no, todos parecen venir del proxy.
- **Frontend:** `npm run build` genera la carpeta `dist/` (archivos estáticos) lista para un hosting estático. Antes de publicar: definir `VITE_API_URL` con la dirección de la API, poner el dominio del frontend en `CORS_ALLOWED_ORIGINS` del backend, y configurar el hosting para que cualquier ruta (por ejemplo `/canchas-los-andes`) sirva `index.html`. El paquete principal pesa unos 485 KB (152 KB comprimido); dividirlo por pantallas es una mejora posible.
- **Acceso con Google en el panel:** el botón ya se muestra, pero Google solo lo habilita para orígenes autorizados. En Google Cloud Console, agregar a los "Orígenes de JavaScript autorizados" `http://localhost:5173` y también `http://localhost` (Google pide ambos para probar en local), y el dominio real al publicar. Los cambios pueden tardar minutos en aplicarse. El frontend recibe el ID como `VITE_GOOGLE_CLIENT_ID` al compilar.
- **Acceso con Google:** crear un ID de cliente OAuth de tipo "Aplicación web" en Google Cloud Console, autorizar el dominio del frontend y entregarlo como `GOOGLE_CLIENT_ID`. Sin él, el endpoint responde 503.
- **Tokens:** se firman con `SECRET_KEY`, que debe ser larga y secreta. Los refresh usados se acumulan en la base de datos; programar `python manage.py flushexpiredtokens` (por ejemplo a diario).
- **Correo (propuesta D71: Resend, y Brevo si se supera su límite):** 1) elegir el nombre del producto y **comprar un dominio** (sin él, ningún proveedor entrega a clientes reales); 2) crear la cuenta del proveedor y agregar el dominio; 3) copiar al DNS los registros SPF y DKIM que el proveedor indica, más un registro DMARC con `p=none`; 4) definir `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` (con una dirección de ese dominio) y `FRONTEND_URL`; 5) comprobar con `python manage.py send_test_email tu@correo`, que muestra el error completo si algo falla. Cada reserva genera de 4 a 5 correos, así que 100 correos al día alcanzan para unas 20 reservas diarias; el aviso se registra pero se pierde si el proveedor corta el envío por pasarse del límite. El envío en segundo plano de recuperar contraseña usa un hilo del propio proceso; si el hosting duerme el proceso, el correo puede perderse y la persona debe pedirlo otra vez.
- **Recordatorios** antes de la reserva (NT-05) siguen para después: necesitan una tarea programada.
- **Expiración programada:** el comando `python manage.py expire_pending_bookings` ordena los datos y conviene ejecutarlo cada pocos minutos. Si no corre, el sistema sigue siendo correcto (la expiración también ocurre al consultar y al reservar).

## Orden y dependencias

```
M0 → M1 → M2 → M3 → M4 → M5 ─┬→ M7 ─┐
                  │          │      ├→ M9 → M10
                  └──────────┴→ M6 ─┘
                                M8 (después de M4)
```

M6 puede empezar en paralelo con M5 cuando M4 esté estable.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Reservas duplicadas por solicitudes simultáneas | Restricción de exclusión en PostgreSQL (M1) y prueba de concurrencia (M4) |
| El proveedor de base de datos no permite `btree_gist` | Se prueba en M1 con PostgreSQL local y se confirma con el proveedor antes de M10 |
| Un negocio ve datos de otro | Capa común de consultas por negocio y pruebas de aislamiento (M5) |
| Errores de zona horaria | Todo se guarda en UTC y se convierte por negocio; casos de prueba en M3 |
| Alcance que crece | El MVP se mide con un criterio: que las reservas funcionen. Lo demás va a "Después" |
