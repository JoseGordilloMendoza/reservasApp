# 01 - Visión y alcance

> Borrador v0.1. Documento vivo: se ajusta conforme se cierran las preguntas abiertas de [02-decisiones.md](02-decisiones.md).

## 1. Visión

Una plataforma donde **negocios que alquilan o atienden por horario** (canchas, consultorios de psicología y afines) gestionan sus reservas, y **sus clientes reservan en línea** sin llamadas ni mensajes de ida y vuelta.

La plataforma **solo gestiona la reserva**. El pago, la atención y la relación comercial ocurren fuera, entre el negocio y su cliente.

## 2. Actores

| Actor | Descripción |
|---|---|
| **Negocio** (tenant) | Se registra, configura recursos, horarios y reglas, y administra sus reservas |
| **Cliente final** | Reserva desde el link del negocio, sin cuenta |
| **Superadmin** | Equipo de la plataforma: da de alta negocios y administra suscripciones |

## 3. Idea central del modelo

Todo rubro se reduce a: **un recurso + un horario + un cliente = una reserva**.

- **Recurso:** lo que se reserva (cancha 1, el psicólogo Juan).
- **Servicio / tipo de reserva:** define duración y reglas (bloque de 1 h, sesión de 50 min).
- **Disponibilidad:** cuándo se puede reservar cada recurso.
- **Reserva:** cliente + recurso + horario + estado.

Un rubro nuevo debe poder agregarse **con configuración**, sin cambiar código.

## 4. Configurable por negocio

- Duración de los bloques o servicios (fija o variable).
- Horarios de atención y días cerrados.
- Tiempo que una reserva pendiente bloquea el horario antes de expirar.
- Confirmación automática o manual.
- Anticipación mínima para cancelar o reprogramar (con un valor por defecto común en Perú).
- Cantidad de recursos y qué es cada uno.

## 5. Flujo de reserva

```
Cliente elige recurso y horario
        │
        ▼
   PENDIENTE ──(expira sin confirmar)──► EXPIRADA
        │
        ├──(negocio o regla automática confirma)──► CONFIRMADA ──► COMPLETADA
        │                                               │
        └──────────────► CANCELADA ◄────────────────────┤
                                                        └──► NO ASISTIÓ
```

El pago (Yape, Plin, efectivo) se coordina fuera de la plataforma. El negocio puede marcar la reserva como confirmada cuando lo recibe.

## 6. Alcance

### MVP
- Alta de negocios y gestión de suscripción (panel mínimo de superadmin).
- Página pública por negocio con link propio (`/nombre-negocio`).
- Configuración de recursos, horarios y reglas por negocio.
- Reserva por cliente sin cuenta (nombre y celular).
- Panel del negocio: ver, confirmar, cancelar reservas y bloquear horarios.
- Estados de reserva y expiración de pendientes.
- Link único para que el cliente consulte o cancele su reserva.
- Notificaciones sin costo (email y botón de WhatsApp con mensaje prellenado).
- Web responsive instalable (PWA).
- Rubro inicial: **canchas deportivas**.

### Fuera del MVP (el modelo debe admitirlo)
- Reservas recurrentes (el mismo horario cada semana).
- Varios usuarios por negocio con roles.
- Cuentas de cliente.
- Directorio o buscador público (marketplace).
- Pagos en línea y cobro automático de suscripciones.
- WhatsApp oficial con envío automático.
- App nativa en tiendas.
- Reseñas, fichas clínicas y facturación electrónica.

## 7. Contexto

- **Ubicación:** Arequipa, Perú. **Moneda:** soles (PEN).
- **Suscripción:** mensual, acordada con cada negocio y gestionada de forma manual al inicio.
- **Piloto:** aún sin negocio definido; se buscará uno del rubro canchas.
