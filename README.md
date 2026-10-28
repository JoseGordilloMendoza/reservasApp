# reservasApp

Plataforma SaaS multi-negocio de reservas (canchas deportivas, psicólogos y negocios afines), pensada para Arequipa, Perú.

**Estado:** fase de documentación y definición de requisitos. Aún no hay código.

## Documentación

| Documento | Contenido |
|---|---|
| [01 - Visión y alcance](docs/01-vision-y-alcance.md) | Qué es el producto, actores, alcance del MVP |
| [02 - Registro de decisiones](docs/02-decisiones.md) | Decisiones tomadas, su motivo y preguntas abiertas |
| [03 - Investigación de mercado](docs/03-investigacion-mercado.md) | Competidores y prácticas del sector |
| [04 - Glosario](docs/04-glosario.md) | Términos del dominio |
| [05 - Requisitos](docs/05-requisitos.md) | Requisitos funcionales y no funcionales |
| [06 - Reglas de negocio](docs/06-reglas-de-negocio.md) | Reglas de disponibilidad, reserva, cancelación y suscripción |
| [07 - Arquitectura](docs/07-arquitectura.md) | Stack, multi-tenancy, modelo de datos y API (propuesta) |

## Principios

1. **Flexible por configuración:** lo que varía entre negocios (duración de bloques, cancelación, confirmación) se configura, no se programa.
2. **Simple primero:** el MVP prueba que las reservas funcionan.
3. **Convención de idioma:** documentación en español; código, rutas de la API y commits en inglés.
4. **Preparado para crecer:** el modelo de datos admite recurrencia, varios recursos y varios usuarios aunque su interfaz llegue después.
