# 02 - Registro de decisiones

Cada decisión indica su estado: **Tomada**, **Propuesta** (pendiente de confirmar) o **Abierta**.

## Decisiones

| # | Decisión | Estado | Motivo |
|---|---|---|---|
| D1 | Modelo SaaS multi-negocio (multi-tenant) | Tomada | Objetivo del proyecto |
| D2 | Cada negocio tiene su **link propio**; el directorio/marketplace queda para después | Propuesta | Evita el problema de atraer demanda; encaja con el uso de WhatsApp e Instagram; es más simple |
| D3 | Ingresos por **suscripción**, acordada con cada negocio | Tomada | Decisión del fundador |
| D4 | Sin pasarela de pagos; cobro de suscripción manual | Tomada | Simplicidad inicial |
| D5 | Panel mínimo de superadmin en lugar de editar la base de datos a mano | Tomada | Menos riesgo en producción con poco esfuerzo |
| D6 | Mercado inicial: Arequipa, Perú; moneda soles | Tomada | Contexto del fundador |
| D7 | Los pagos de reservas ocurren fuera de la plataforma | Tomada | La plataforma solo gestiona reservas |
| D8 | Reservas con estados: pendiente, confirmada, completada, cancelada, expirada, no asistió | Propuesta | Permite operar sin pagos en línea y evita reservas falsas |
| D9 | Confirmación **automática o manual**, configurable por negocio | Tomada | Flexibilidad por negocio |
| D10 | Política de cancelación **configurable** con un valor por defecto común en Perú | Tomada | El valor exacto se define después |
| D11 | Duración de bloques y servicios configurable por negocio | Tomada | Flexibilidad por negocio |
| D12 | Clientes finales **sin cuenta** (nombre y celular) con link único para gestionar su reserva | Propuesta | Mínima fricción; se endurece si hay abuso |
| D13 | Un negocio tiene uno o más **recursos**; el modelo admite varios usuarios con roles, pero el MVP usa solo el dueño | Propuesta | Flexibilidad sin complejidad inicial |
| D14 | Reservas recurrentes: fuera del MVP, modelo preparado | Propuesta | Importante para canchas, pero no necesario para validar |
| D15 | Web responsive instalable (PWA) primero; app nativa después si hace falta | Propuesta | El cliente entra por link; evita instalar y publicar en tiendas |
| D16 | Notificaciones de bajo costo: email y botón `wa.me`; WhatsApp oficial después | Propuesta | Evitar costo por mensaje |
| D17 | Sin videollamada ni modalidad virtual | Tomada | Solo se gestionan reservas |
| D18 | Criterio de éxito del MVP: las reservas funcionan | Tomada | Alcance mínimo |
| D19 | Rubro inicial: canchas deportivas | Tomada | Es el caso más claro y frecuente |

## Preguntas abiertas

| # | Pregunta | Notas |
|---|---|---|
| Q1 | Valor por defecto de la política de cancelación | Se propondrá una base y cada negocio la ajusta |
| Q2 | Tiempo por defecto que una reserva pendiente bloquea el horario | Depende de cómo coordinen el pago los negocios |
| Q3 | Precio de la suscripción | Se conversará con los negocios |
| Q4 | Nombre del producto y dominio | Pendiente |
| Q5 | Piloto: ¿qué negocio de canchas? | Aún sin definir |
| Q6 | Cumplimiento de la Ley de Protección de Datos Personales de Perú | Revisar qué datos se guardan y cómo se informa al cliente |
