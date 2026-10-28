# 08 - Plan de construcción

> Borrador v0.1. Los hitos se ordenan para **reducir riesgo primero**: lo más delicado (no permitir reservas solapadas) se construye y prueba antes que la interfaz.

El desarrollo corre en contenedores con **Docker Compose** (PostgreSQL y backend). El **despliegue sigue pendiente** (ver [Q7](02-decisiones.md)).

## Hitos

**Avance:** M0 a M4 completados. M5 casi completo (471 pruebas): falta la gestión de la configuración del negocio. Siguiente: terminar M5 y seguir con M6.

**Pendiente de M5:** API para gestionar recursos, servicios, horarios semanales, perfil público y opciones del negocio (NG-02 a NG-05, CF-01 a CF-06). La lógica de disponibilidad ya los usa; falta exponerlos al dueño. El perfil público necesita campos nuevos en el negocio (descripción, dirección, teléfono, WhatsApp).

| Hito | Objetivo | Entregables | Listo cuando |
|---|---|---|---|
| **M0. Base del proyecto** | Entorno reproducible | Docker Compose con PostgreSQL y Django, ajustes por variables de entorno, pruebas ejecutables en contenedor | `docker compose up` levanta el backend y `pytest` corre |
| **M1. Reservas sin solapamiento** | Garantizar la integridad desde la base de datos | Modelos de negocio, recurso, servicio, cliente y reserva; restricción de exclusión; admin básico | Las pruebas demuestran que un recurso nunca tiene dos reservas activas solapadas |
| **M2. Configuración y plantillas** | Flexibilidad por negocio | Esquema de `settings` validado, herencia servicio → negocio → plataforma, plantillas de rubro | Un negocio nuevo nace con los valores de su rubro y se pueden cambiar |
| **M3. Disponibilidad** | Calcular horarios libres | Reglas semanales, bloqueos, cálculo de espacios libres respetando anticipación, horizonte e intervalos | Para un recurso y una fecha se obtienen los horarios correctos, con pruebas de casos borde |
| **M4. API pública de reserva** | El cliente puede reservar | Consultar disponibilidad, crear reserva, expiración, link de gestión, cancelación por el cliente, límite de solicitudes | Se puede reservar y cancelar de principio a fin con la API; dos solicitudes simultáneas no duplican el horario |
| **M5. API del panel** | El negocio gestiona sus reservas | Inicio de sesión, aislamiento entre negocios, confirmar, rechazar, cancelar, reservas manuales, bloqueos, clientes | Un negocio opera todo su flujo y nunca ve datos de otro (pruebas de aislamiento) |
| **M6. Frontend público (PWA)** | Pantalla de reserva para el cliente | Página del negocio, selección de horario, formulario, resultado, gestión por link | Una reserva completa desde un celular |
| **M7. Frontend del panel** | Pantalla de gestión | Calendario, lista, acciones sobre reservas, configuración | El dueño gestiona su negocio sin usar el admin |
| **M8. Notificaciones** | Avisos sin costo | Correo al negocio y al cliente, botones de WhatsApp con mensaje prellenado | Los avisos salen en los eventos clave |
| **M9. Superadmin y suscripciones** | Operar como SaaS | Alta de negocios, suscripción y vigencia, suspensión y reactivación | Se da de alta un negocio y se suspende sin perder datos |
| **M10. Despliegue y piloto** | Salir a producción | Imagen de producción, hosting elegido, respaldos, dominio | Un negocio real recibe reservas |

## Pendiente para M10 (revisado con `check --deploy`)

El backend arranca limpio desde cero con `docker compose up` y sus endpoints responden, pero la imagen actual es de desarrollo. Antes de publicar falta:

- Imagen de producción con servidor de aplicaciones (por ejemplo gunicorn) en lugar de `runserver`, y archivos estáticos del admin.
- Ajustes HTTPS: `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`. Django los marca como advertencias con `DEBUG` apagado.
- `SECRET_KEY` larga y aleatoria como variable de entorno (el sistema ya se niega a arrancar sin ella cuando `DEBUG` está apagado).
- Fijar versiones exactas de las dependencias.
- Decidir si la documentación de la API (`API_DOCS_ENABLED`) se publica.
- **Límite de solicitudes:** hoy usa la memoria de cada proceso. Con varios procesos o servidores cada uno cuenta por separado, así que en producción hace falta un caché compartido (Redis o base de datos). Detrás de un proxy también hay que configurar `NUM_PROXIES` para leer la dirección real del cliente; si no, todos parecen venir del proxy.
- **Acceso con Google:** crear un ID de cliente OAuth de tipo "Aplicación web" en Google Cloud Console, autorizar el dominio del frontend y entregarlo como `GOOGLE_CLIENT_ID`. Sin él, el endpoint responde 503.
- **Tokens:** se firman con `SECRET_KEY`, que debe ser larga y secreta. Los refresh usados se acumulan en la base de datos; programar `python manage.py flushexpiredtokens` (por ejemplo a diario).
- **Recuperar contraseña** (NG-01) queda para M8, junto con el envío de correos.
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
