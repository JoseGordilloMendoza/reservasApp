# reservasApp

Plataforma SaaS multi-negocio de reservas (canchas deportivas, psicólogos y negocios afines), pensada para Arequipa, Perú.

**Estado:** documentación base lista. Hitos M0 a M3 del [plan](docs/08-plan-de-construccion.md) completados: entorno con Docker, modelo de reservas con restricción anti-solapamiento, configuración por negocio con plantillas de rubro, y cálculo de disponibilidad. 98 pruebas.

## Cómo ejecutar

Requiere Docker Desktop.

```bash
docker compose up                                   # backend en http://localhost:8000
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser
docker compose run --rm backend pytest              # pruebas
```

| URL | Qué es |
|---|---|
| http://localhost:8000/api/docs/ | Lista interactiva de endpoints (Swagger) |
| http://localhost:8000/api/health/ | Estado de la API y la base de datos |
| http://localhost:8000/admin/ | Admin de Django (superadmin) |

`docker compose up` aplica las migraciones al arrancar.

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
| [08 - Plan de construcción](docs/08-plan-de-construccion.md) | Hitos M0 a M10, dependencias y riesgos |

## Principios

1. **Flexible por configuración:** lo que varía entre negocios (duración de bloques, cancelación, confirmación) se configura, no se programa.
2. **Simple primero:** el MVP prueba que las reservas funcionan.
3. **Convención de idioma:** documentación en español; código, rutas de la API y commits en inglés.
4. **Preparado para crecer:** el modelo de datos admite recurrencia, varios recursos y varios usuarios aunque su interfaz llegue después.
