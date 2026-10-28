# reservasApp

Plataforma SaaS multi-negocio de reservas (canchas deportivas, psicólogos y negocios afines), pensada para Arequipa, Perú.

**Estado:** documentación base lista. **El backend del MVP está completo** (hitos M0 a M5 del [plan](docs/08-plan-de-construccion.md)): entorno con Docker, reservas sin solapamiento, configuración por negocio, disponibilidad, API pública de reservas, acceso con correo y Google, y API del panel (reservas, clientes, bloqueos, recursos, servicios, horarios y perfil). 587 pruebas del backend, incluidas pruebas de concurrencia con conexiones reales. El **frontend público** (M6) está listo: página del negocio, reserva, boleto, cancelación y "Mis reservas", instalable como aplicación, con 99 pruebas. El **panel del negocio** (M7) está completo: entrar con correo o Google, ver lo urgente, gestionar reservas, anotar las que llegan por teléfono, ver y bloquear clientes, cerrar horarios y configurar su página, reglas, espacios, horarios y servicios (297 pruebas del frontend). Siguen los correos y la recuperación de contraseña (M8).

## Cómo ejecutar

Requiere Docker Desktop.

```bash
docker compose up                                   # backend en http://localhost:8000
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser
docker compose run --rm backend pytest              # pruebas
```

`docker compose up` levanta la base de datos, el backend y el frontend. Para ver la aplicación con datos:

```bash
docker compose run --rm backend python manage.py seed_demo
```

Crea una cancha y un consultorio de ejemplo, cada uno con su dueño (`canchas@demo.pe` y `consultorio@demo.pe`, contraseña `demo12345`). Solo funciona en desarrollo.

| URL | Qué es |
|---|---|
| http://localhost:5173/canchas-los-andes | Página de reserva de la cancha de ejemplo (frontend) |
| http://localhost:5173/consultorio-lucia | La del consultorio, con otro color |
| http://localhost:5173/mis-reservas | Boletos guardados en este dispositivo |
| http://localhost:5173/panel | Panel del negocio (entra con `canchas@demo.pe` / `demo12345`) |
| http://localhost:8000/api/docs/ | Lista interactiva de endpoints (Swagger) |
| http://localhost:8000/api/health/ | Estado de la API y la base de datos |
| http://localhost:8000/admin/ | Admin de Django (superadmin) |

`docker compose up` aplica las migraciones al arrancar.

Si cambian las dependencias del frontend (`package.json`), recrea su contenedor con `docker compose up -d --build -V frontend`; sin `-V` reutiliza las dependencias viejas y no arranca.

## Dar de alta un negocio y su dueño

Por ahora lo hace la plataforma desde el admin (http://localhost:8000/admin/):

1. Crear un superusuario: `docker compose run --rm backend python manage.py createsuperuser` (el identificador es el correo).
2. En el admin, crear el **Negocio** (`business_type` elige la plantilla de valores iniciales).
3. Crear el **Usuario** del dueño y, en el mismo formulario, agregarle una **Pertenencia** al negocio con rol `owner`.

Con eso basta: el dueño inicia sesión con `POST /api/v1/auth/login/` y **él mismo** configura su perfil, opciones, recursos, servicios y horarios con la API del panel (`/api/v1/panel/...`, documentada en `/api/docs/`). Si el usuario no tiene contraseña, solo podrá entrar con Google.

## Acceso con Google (opcional)

1. En Google Cloud Console, crear un ID de cliente OAuth de tipo "Aplicación web" y autorizar el dominio del frontend.
2. Copiar `.env.example` a `.env` (Git lo ignora) y poner ahí el valor de `GOOGLE_CLIENT_ID`. `docker compose` lo lee solo.
3. En Google Cloud Console, en "Orígenes de JavaScript autorizados", agregar el de cada frontend (por ejemplo `http://localhost:5173` y `http://localhost` en desarrollo, y el dominio real en producción; Google puede tardar unos minutos en aplicar el cambio).

Mientras no esté configurado, `POST /api/v1/auth/google/` responde 503. Google solo permite entrar a usuarios que ya existen. Solo se usa el ID de cliente, que es público; el secreto de cliente no hace falta y no debe compartirse.

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
| [09 - Diseño del frontend](docs/09-diseno-frontend.md) | Dirección visual, sistema, pantallas y reglas de contenido |

## Principios

1. **Flexible por configuración:** lo que varía entre negocios (duración de bloques, cancelación, confirmación) se configura, no se programa.
2. **Simple primero:** el MVP prueba que las reservas funcionan.
3. **Convención de idioma:** documentación en español; código, rutas de la API y commits en inglés.
4. **Preparado para crecer:** el modelo de datos admite recurrencia, varios recursos y varios usuarios aunque su interfaz llegue después.
