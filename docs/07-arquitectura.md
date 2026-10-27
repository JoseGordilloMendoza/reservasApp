# 07 - Arquitectura

> Borrador v0.1. Es una **propuesta** para discutir. Se apoya en la experiencia previa del equipo con Django, DRF y React (proyecto KAJA), lo que reduce el costo de aprendizaje.

## 1. Principios

1. **Monolito modular.** Una sola aplicación bien organizada en módulos. Para este tamaño, los microservicios solo añadirían complejidad.
2. **La base de datos protege la integridad.** Lo crítico (sin reservas solapadas) se garantiza con restricciones en PostgreSQL.
3. **Configuración antes que código.** Lo que varía por negocio vive en datos validados.
4. **Dependencias externas reemplazables.** Correo, almacenamiento y WhatsApp se usan detrás de una interfaz propia.
5. **Costo bajo.** Pocos componentes, todos con planes económicos.

## 2. Stack propuesto

| Capa | Elección | Motivo |
|---|---|---|
| Backend | Python, Django 5.2 y Django REST Framework | Ya lo conoces; administración integrada útil como panel de superadmin inicial |
| Base de datos | PostgreSQL | Necesaria para la restricción de exclusión que evita solapamientos |
| Frontend | React con Vite y TypeScript, como PWA | Ya lo conoces; instalable y sin tiendas de apps |
| Tareas programadas | Comando de Django invocado por un cron del hosting | Basta para expirar reservas; Celery y Redis se añaden si hace falta |
| Correo | Proveedor transaccional con capa gratuita | Costo mínimo |
| Hosting | Por definir | Ver preguntas abiertas |

## 3. Multi-tenancy

**Una sola base de datos y un solo esquema, con una columna `negocio_id` en cada tabla del negocio.**

- Es lo más simple de operar y de migrar, y alcanza para cientos de negocios.
- El aislamiento se centraliza en una capa común: todas las consultas pasan por un gestor que filtra por negocio, y las pruebas automáticas verifican que no haya fugas (NF-02).
- La alternativa de un esquema por negocio queda descartada por complejidad de migraciones y operación.

El **negocio activo** se determina así: en la web pública, por el slug de la URL; en el panel, por el usuario autenticado.

## 4. Modelo de datos (borrador)

```
Negocio ──< Recurso ──< Servicio
   │            │
   │            ├──< ReglaDisponibilidad   (horario semanal)
   │            ├──< Bloqueo               (excepciones)
   │            └──< Reserva >── Cliente
   │
   ├──< Usuario        (dueño; luego staff con roles)
   ├──< Cliente        (por negocio, clave: celular)
   └─── Suscripcion    (plan, precio, vigencia)

Reserva ──< EventoReserva   (historial de estados)
```

| Entidad | Campos clave |
|---|---|
| **Negocio** | slug único, nombre, perfil público, zona horaria, `configuracion` (JSON validado), estado |
| **Recurso** | negocio, nombre, activo, orden |
| **Servicio** | recurso, nombre, duración, precio referencial, `configuracion` que sobrescribe la del negocio |
| **ReglaDisponibilidad** | recurso, día de la semana, hora de inicio y de fin |
| **Bloqueo** | recurso (o todo el negocio), rango de fechas y horas, motivo |
| **Cliente** | negocio, nombre, celular en formato `+51...`, email opcional, bloqueado |
| **Reserva** | negocio, recurso, servicio, cliente, `inicio`, `fin`, estado, `expira_en`, precio y duración vigentes, origen (cliente o negocio), `serie_id` (vacío en el MVP), hash del token de gestión |
| **EventoReserva** | reserva, estado anterior y nuevo, fecha, autor |
| **Suscripcion** | negocio, plan, precio, inicio, vigencia, estado |

### Integridad contra solapamientos

PostgreSQL permite una **restricción de exclusión** sobre rangos de tiempo. Django la soporta con `ExclusionConstraint` y la extensión `btree_gist`:

```
no puede haber dos filas con el mismo recurso y rangos de tiempo
que se solapen, cuando el estado es pendiente o confirmada
```

Así, aunque dos solicitudes lleguen al mismo milisegundo, la base de datos rechaza la segunda.

**Expiración:** la restricción no puede depender de la hora actual. Por eso, al crear una reserva, dentro de la misma transacción se marcan como expiradas las pendientes vencidas que se solapan con el nuevo horario. Además, un cron periódico expira el resto, de modo que los datos quedan correctos aunque nadie reserve.

### Configuración flexible

- `configuracion` del negocio y del servicio es un JSON cuya forma se valida con un esquema versionado.
- Al leer un valor se busca en este orden: **servicio → negocio → valor por defecto de la plataforma**.
- Agregar una opción nueva implica definirla en el esquema con su valor por defecto; los negocios existentes no necesitan migración.

### Disponibilidad

Los horarios libres **no se almacenan**: se calculan al consultar, a partir de reglas, bloqueos y reservas. Evita datos desactualizados y facilita las reservas recurrentes más adelante.

## 5. API

API REST en `/api/v1/`, dividida por audiencia:

| Zona | Ejemplo | Autenticación |
|---|---|---|
| Pública | `GET /api/v1/publico/{slug}/disponibilidad`, `POST /api/v1/publico/{slug}/reservas` | Ninguna, con límite de solicitudes |
| Gestión del cliente | `GET` y `DELETE /api/v1/publico/reservas/{token}` | Token del link |
| Panel del negocio | `GET /api/v1/panel/reservas` | Sesión del usuario |
| Superadmin | `/admin/` de Django en el MVP | Sesión de superusuario |

## 6. Estructura de módulos

```
backend/
  config/            ajustes del proyecto
  apps/
    negocios/        negocio, suscripción, configuración
    catalogo/        recursos, servicios
    disponibilidad/  reglas, bloqueos, cálculo de horarios libres
    reservas/        reserva, estados, expiración
    clientes/        clientes y bloqueos
    notificaciones/  correo y enlaces de WhatsApp (interfaz reemplazable)
    cuentas/         usuarios y acceso
frontend/
  src/
    publico/         flujo de reserva del cliente
    panel/           panel del negocio
```

## 7. Decisiones de arquitectura propuestas

| # | Decisión |
|---|---|
| A1 | Monolito modular con Django y DRF |
| A2 | PostgreSQL con restricción de exclusión para impedir solapamientos |
| A3 | Multi-tenancy por columna `negocio_id` en un solo esquema |
| A4 | Configuración en JSON validado con herencia servicio → negocio → plataforma |
| A5 | Disponibilidad calculada, no almacenada |
| A6 | Frontend React con Vite y TypeScript como PWA |
| A7 | Expiración mediante cron más expiración al crear una reserva |
| A8 | Panel de superadmin con el admin de Django en el MVP |

## 8. Preguntas abiertas

1. **Hosting y presupuesto mensual.** KAJA tiene un `Procfile`; ¿usas un servicio tipo Heroku, Railway o Render para ese proyecto? Eso orienta dónde alojar este.
2. **Un repositorio o dos.** Propongo uno solo (monorepo) con `backend/` y `frontend/`, para mantener la documentación y el código juntos.
3. **Dominio.** ¿Se usará un dominio propio con subdominio por negocio o con ruta (`app.pe/negocio`)? La ruta es más simple.
4. **Idioma del código.** ¿Nombres de modelos en español (como en este borrador) o en inglés? Conviene decidirlo antes de escribir código.
