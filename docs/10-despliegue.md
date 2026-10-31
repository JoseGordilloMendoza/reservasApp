# 10 - Despliegue de prueba (todo gratis)

> Guía para montar el sistema en internet sin gastar y recorrer el flujo completo. **No es para clientes reales**: el servidor gratuito se duerme y los correos solo llegan a una dirección.
>
> Cada dato de esta guía se contrastó con la documentación oficial de cada servicio el **31 de octubre de 2026** (fuentes al final). Donde la documentación no responde, lo digo con la marca **(sin confirmar)** y explico cómo comprobarlo. Las decisiones están en [D82](02-decisiones.md).

## Resumen

| Orden | Qué haces | Dónde | Tiempo aprox. |
|---|---|---|---|
| 1 | Crear la clave de correo del servidor | Resend | 3 min |
| 2 | Crear la base de datos | Neon | 10 min |
| 3 | Publicar la API | Render | 15 min (la primera construcción tarda) |
| 4 | Publicar la aplicación | Cloudflare Pages | 10 min |
| 5 | Unir la API con la aplicación | Render | 5 min |
| 6 | Recorrer el flujo | tu navegador | 30 min |

```
 Cliente / dueño / equipo ──► Cloudflare Pages (la aplicación, archivos estáticos)
                                      │  llama a
                                      ▼
                              Render (la API, Django)  ──► Neon (PostgreSQL, São Paulo)
                                      │
                                      └──► Resend (correos, puerto 2587)
```

## Lo que debes saber antes (y que cambió respecto a lo que pensaba)

1. **Render gratis no puede enviar correo por los puertos 25, 465 ni 587** (su documentación lo dice: *"Free web services can't send outbound network traffic on ports 25, 465, or 587"*). Por eso la configuración usa el **puerto 2587** de Resend, que no está en esa lista. **(sin confirmar que funcione desde Render)**: la primera comprobación del paso 6 lo verifica. Si falla, hay un plan B (ver "Problemas comunes").
2. **La región de Neon no se puede cambiar después** (*"You cannot change the region for an existing project"*). Elige **São Paulo** desde el principio.
3. **El servidor de Render se duerme tras 15 minutos sin visitas y tarda cerca de un minuto en despertar** (*"This process takes about one minute"*). Además *"Render might restart a Free web service at any time"*.
4. **La base de Neon también se duerme (a los 5 minutos)**, pero despierta en *"a few hundred milliseconds"*. Ya está contemplado en la configuración: se comprueba que cada conexión siga viva antes de reutilizarla.
5. **Cloudflare ahora recomienda Workers para proyectos nuevos**, pero Pages sigue funcionando y documentado. Para esta prueba usamos Pages porque es lo más simple; abajo explico la diferencia.

## Qué esperar de la prueba

- El primer clic tras 15 minutos tarda cerca de un minuto. Es lo que justifica el plan de pago para clientes reales.
- Los correos **solo llegan al correo con el que creaste tu cuenta de Resend**, porque aún no hay dominio. Usa ese mismo correo como dueño de prueba.
- El servidor empieza **vacío**. `seed_demo` solo corre en desarrollo, así que los negocios se crean desde el panel del equipo (que además es la mejor prueba del alta).
- El acceso con Google probablemente no funcione todavía (Google puede no aceptar una dirección `.pages.dev`). Se prueba al final.
- La CPU del plan gratuito es muy pequeña (0.1 CPU y 512 MB), así que todo irá lento al principio.

## Antes de empezar

Ten a mano:

- [ ] Una cuenta de **GitHub** con el repositorio (`JoseGordilloMendoza/reservasApp`, ya subido, rama `main`).
- [ ] Cuentas en **Resend**, **Neon**, **Render** y **Cloudflare**.
- [ ] El **correo con el que creaste tu cuenta de Resend** (importa mucho: es el único que recibirá correos).
- [ ] Una **contraseña larga** para ti como equipo de la plataforma (12 caracteres o más, que no sea solo números ni una palabra común). Será `PLATFORM_ADMIN_PASSWORD`.
- [ ] Un lugar seguro (gestor de contraseñas) donde ir guardando: la clave de Resend, la cadena de Neon y la dirección de Render. **No las pegues en chats ni las subas al repositorio.**

---

## Paso 1: la clave de correo en Resend

La clave que usé en el desarrollo quedó en un chat. Crea **una nueva** para el servidor.

1. En el panel de Resend, entra a **API keys** y pulsa **Create API Key**.
2. **Nombre**: por ejemplo `separa-render` (hasta 50 caracteres).
3. **Permission**: elige **Sending access** (solo enviar correos). La documentación permite además limitarla a un dominio; todavía no tienes uno.
4. Crea la clave y **cópiala ahora**: *"you can only view the API Key once"*. Si la pierdes, creas otra.

Esa clave será `EMAIL_HOST_PASSWORD` en Render. (Después puedes borrar la clave anterior desde la misma pantalla.)

> **(sin confirmar)** La documentación no dice si "Sending access" basta para SMTP, pero no hay razón para que no lo haga. Si el envío falla con un error de autenticación, vuelve a crear la clave con acceso completo.

## Paso 2: la base de datos en Neon

1. Entra a la consola: **console.neon.tech**.
2. Pulsa **New Project**.
3. **Project name**: `separa` (hasta 64 caracteres).
4. **Region**: **AWS South America (São Paulo) — `aws-sa-east-1`**. Es la más cercana a Perú de las disponibles. **No se puede cambiar después.**
5. **Postgres version**: expande la sección *Postgres database* y elige la **17** (la misma que usamos en desarrollo). La documentación no dice cuál es la versión por defecto.
6. Pulsa **Create project**. Neon crea una base llamada `neondb` y un rol `neondb_owner`.

### Asegurar la extensión que impide los solapes

La primera migración de la API ejecuta `CREATE EXTENSION btree_gist` con el rol de la cadena de conexión. La documentación lista `btree_gist` como compatible (versión 1.7 en PostgreSQL 15 a 17), pero **no dice que el rol por defecto tenga permiso para crearla (sin confirmar)**. Lo más seguro es crearla tú antes:

1. En Neon, abre el **SQL Editor**.
2. Ejecuta: `CREATE EXTENSION IF NOT EXISTS btree_gist;`
3. Debe responder sin error. Si ya existe, la migración de la API no necesitará ningún permiso.

### La cadena de conexión

1. Pulsa el botón **Connect** de la consola.
2. Elige la rama (`main`), la base (`neondb`) y el rol (`neondb_owner`).
3. **Desactiva el interruptor "Connection pooling"** (viene activado por defecto) para obtener la cadena **directa**, la que **no** lleva `-pooler` en el nombre del servidor.
4. Copia la cadena **tal como viene** (la documentación dice que *"The connection string you copy from the Connect modal is your DATABASE_URL. Assign it as-is."*). Se parece a:

   ```
   postgresql://neondb_owner:LA_CLAVE@ep-algo-1234.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   Ya trae `sslmode=require` y `channel_binding=require`. No la modifiques.

**Por qué la directa y no la del pooler:** la del pooler usa PgBouncer en modo transacción, que no admite varias cosas de sesión (`SET`, `LISTEN`, sentencias `PREPARE`...). La propia documentación de Neon recomienda la conexión directa para migraciones. Nuestra API abre pocas conexiones (un proceso con 4 hilos), así que no necesita el pooler. Esta es mi decisión, razonada con la documentación, pero la documentación **no menciona Django ni psycopg 3 (sin confirmar)**.

Guarda la cadena: será `DATABASE_URL` en Render.

---

## Paso 3: la API en Render

### 3.1 Conectar GitHub y crear el Blueprint

1. Entra a **dashboard.render.com**.
2. Pulsa **New → Blueprint**.
3. Si es la primera vez, te pedirá **conectar tu cuenta de GitHub**; autoriza el acceso al repositorio `reservasApp` (sirve para públicos y privados).
4. Pulsa **Connect** junto al repositorio. Render usa por defecto el `render.yaml` de la raíz, que ya está preparado.
5. Ponle un nombre al Blueprint (por ejemplo `separa`) y elige la rama **`main`**.
6. Revisa la lista de cambios: debe mostrar **un servicio web `separa-api`** en el plan gratuito.

### 3.2 Los valores secretos

Render te pide un valor por cada variable marcada `sync: false`. **Solo lo pregunta esta vez**: *"Render prompts you for these values only during the initial Blueprint creation"*. Después se cambian desde el servicio → **Environment**.

| Variable | Qué poner |
|---|---|
| `DATABASE_URL` | La cadena **directa** de Neon (paso 2) |
| `PLATFORM_ADMIN_EMAIL` | Tu correo de Resend (será tu usuario de equipo) |
| `PLATFORM_ADMIN_PASSWORD` | La contraseña larga que elegiste |
| `EMAIL_HOST_PASSWORD` | La clave de API de Resend del paso 1 |
| `CORS_ALLOWED_ORIGINS` | Temporal: `https://ejemplo.pages.dev` (se corrige en el paso 5) |
| `FRONTEND_URL` | Temporal: `https://ejemplo.pages.dev` (se corrige en el paso 5) |
| `GOOGLE_CLIENT_ID` | Déjalo vacío por ahora |

Las demás variables ya están en el archivo: `DEBUG=0`, `SECRET_KEY` (Render la **genera**, 256 bits), `NUM_PROXIES=1`, `WEB_CONCURRENCY=1`, `EMAIL_HOST=smtp.resend.com`, `EMAIL_PORT=2587`, `EMAIL_HOST_USER=resend` y `DEFAULT_FROM_EMAIL`.

### 3.3 Desplegar y vigilar

1. Pulsa **Deploy Blueprint**. Render construye la imagen Docker y la inicia.
2. Abre el servicio `separa-api`. En la pestaña **Deploys** ves el avance y en **Logs** la salida (el registro se conserva 7 días en un plan Hobby).
3. En el registro del arranque debes ver, en este orden:
   - las migraciones (`Applying ... OK`),
   - `tu@correo: created as a platform admin.`,
   - `Starting gunicorn` y `Listening at: http://0.0.0.0:10000`.
4. Render muestra la dirección pública del servicio, **`https://<nombre>.onrender.com`** (el panel la muestra junto al nombre; no sé si lleva un sufijo aleatorio). Anótala.
5. Abre `https://<nombre>.onrender.com/api/health/`. Debe responder `{"status":"ok","database":"ok"}`.

> La primera respuesta tras el despliegue puede tardar: el plan gratuito arranca despacio.

---

## Paso 4: la aplicación en Cloudflare Pages

> **Nota sobre Pages y Workers.** La documentación de Cloudflare (agosto de 2026) abre diciendo: *"Workers supports most Pages use cases ... Start new projects with Workers."* Pages **no está retirado** y sigue documentado. Para la prueba usamos **Pages**, que es más simple y cuyo comportamiento para aplicaciones de una sola página está confirmado. Workers (con "static assets") es el camino que Cloudflare impulsa y tiene sus propias reglas, entre ellas que un dominio propio exige que sus servidores de nombres los gestione Cloudflare. Se decide más adelante, con el dominio.

1. En el panel de Cloudflare: **Workers & Pages**.
2. **Create application → Pages → Connect to Git**.
3. Elige **GitHub**, autoriza y selecciona el repositorio. Pulsa **Install & Authorize** y luego **Begin setup**.
4. En *Set up builds and deployments* completa:

   | Campo | Valor |
   |---|---|
   | Project name | `separa` (será parte de la dirección; si está tomado, usa otro) |
   | Production branch | `main` |
   | Framework preset | *React (Vite)* o ninguno |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (advanced) → Path | `frontend` |

5. En **Environment variables** agrega:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://<nombre>.onrender.com/api/v1` (la dirección del paso 3, **con** `/api/v1`) |

   No debería hacer falta `NODE_VERSION`: según la documentación, la imagen de construcción trae Node 22 (22.23.4) por defecto. Si la construcción fallara por la versión de Node, agrega `NODE_VERSION` con valor `22`.
6. Pulsa **Save and Deploy**. Cuando termine tendrás una dirección **`https://<proyecto>.pages.dev`**. Anótala.

**Datos de la documentación que conviene saber:**
- *"If you deploy using the Git integration, you cannot switch to Direct Upload later."*
- Sin un `404.html` en el proyecto, Pages *"assumes that you are deploying a single-page application"* y entrega `index.html` para cualquier ruta, así que no hace falta ninguna regla de redirección. **No agregues `/* /index.html 200` en `_redirects`**: sería contraproducente.
- El archivo `_headers` (ya incluido en `frontend/public/`) usa el formato correcto y se copia al resultado de la construcción. Admite hasta 100 reglas y los comodines como `/assets/*`.
- Plan gratuito: 500 construcciones al mes, de una en una, 20 minutos como máximo cada una; hasta 20 000 archivos de 25 MiB. Cada rama y cada solicitud de cambios en GitHub genera además una dirección de vista previa (que no funcionará con la API por el permiso de CORS; no importa).
- **(sin confirmar)**: si Cloudflare pide tarjeta de crédito, y el ancho de banda incluido.

---

## Paso 5: unir la API con la aplicación

Hay que decirle a la API cuál es la dirección de la aplicación, o el navegador bloqueará las llamadas (CORS) y los enlaces de los correos apuntarán mal.

1. En Render, abre el servicio `separa-api` → **Environment**.
2. Cambia estas dos variables a la dirección de Cloudflare, **sin barra final**:

   | Variable | Valor |
   |---|---|
   | `CORS_ALLOWED_ORIGINS` | `https://<proyecto>.pages.dev` |
   | `FRONTEND_URL` | `https://<proyecto>.pages.dev` |

3. Al guardar, elige **Save and deploy** (o *Save, rebuild, and deploy*). **No uses "Save only"**: no se aplicaría hasta el siguiente despliegue, y un simple *Restart service* **no** incorpora los cambios de variables.

---

## Paso 6: recorrer el flujo

### 6.0 Las tres comprobaciones rápidas (hazlas primero)

1. [ ] `https://<nombre>.onrender.com/api/health/` responde `ok` (ya lo viste).
2. [ ] `https://<proyecto>.pages.dev/` abre el inicio. Luego abre **directamente** `https://<proyecto>.pages.dev/panel/entrar` (escribiendo la dirección, no navegando): debe mostrar la pantalla de entrada. Si da 404, mira "Problemas comunes".
3. [ ] **Correo**: en la pantalla de entrada pulsa **¿Olvidaste tu contraseña?**, escribe el correo de tu cuenta de Resend y envía. Luego, en Render → **Logs**, busca la línea:
   - `email event=password_reset sent=1 of=1` → el correo salió bien. Revisa tu bandeja (y el spam).
   - `email failed event=password_reset` seguido de un error → el correo no salió; mira "Problemas comunes".

### 6.1 Como equipo de la plataforma

- [ ] Entrar con `PLATFORM_ADMIN_EMAIL` y su contraseña en `/panel/entrar` → llegas a **Plataforma**.
- [ ] **Nuevo negocio**: crear uno con *tu correo de Resend* como dueño, tipo cancha, 30 días de prueba.
- [ ] Llega el **correo de bienvenida** con el enlace para elegir contraseña (vale una hora).

### 6.2 Como dueño del negocio

> Si el dueño usa el mismo correo que el equipo, ya tendrás contraseña: el sistema avisa que ya tenías cuenta y no la cambia. Entra con la misma.

- [ ] Entrar al panel del negocio.
- [ ] **Ajustes → Espacios y horarios**: crear una cancha y su horario semanal.
- [ ] **Ajustes → Servicios**: crear un servicio con duración y precio.
- [ ] **Ajustes → Mi página**: activar **"Aparecer en el buscador"** y guardar.

### 6.3 Como cliente (abre una ventana privada)

- [ ] En `/` **buscar el negocio por nombre** y entrar a su página.
- [ ] Reservar un horario con nombre, celular y tu correo.
- [ ] **Mide cuánto tarda la reserva.** Si tarda 10 segundos o más, el correo está intentando salir por un puerto bloqueado (ver "Problemas comunes").
- [ ] Llega el correo de recibo con el enlace del boleto, y el panel del dueño muestra la reserva **por confirmar**.
- [ ] Confirmarla desde el panel y ver el boleto cambiar de estado.

### 6.4 Otras comprobaciones

- [ ] **Plataforma → el negocio → Suscripción**: registrar un pago y ver la vigencia avanzar.
- [ ] **Entrar como soporte** al negocio y terminarlo; ver **Actividad**.
- [ ] Instalar la aplicación en el celular (menú del navegador → *Añadir a pantalla de inicio*).
- [ ] Dejar la API 20 minutos sin visitas y medir cuánto tarda en abrir.

---

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El registro de Render dice error al conectar a la base | `DATABASE_URL` mal copiada, o se usó la del pooler | Copia de nuevo la cadena **directa** (interruptor de pooling apagado) y vuelve a desplegar |
| Error al crear `btree_gist` en la migración | El rol de Neon no tiene permiso | En Neon → SQL Editor: `CREATE EXTENSION IF NOT EXISTS btree_gist;` y redespliega |
| `PLATFORM_ADMIN_PASSWORD is not acceptable` | Contraseña corta o común | Elige otra más larga en *Environment* y redespliega |
| `/api/health/` responde 400 "DisallowedHost" | La dirección no está entre los hosts permitidos | Render agrega su propia dirección sola. Si usas un dominio propio, ponlo en `ALLOWED_HOSTS` |
| El navegador muestra errores de CORS | `CORS_ALLOWED_ORIGINS` no coincide exactamente con la dirección de Cloudflare | Debe ser idéntica, con `https://` y **sin barra final**; guarda con *Save and deploy* |
| Los enlaces de los correos van a `localhost:5173` | `FRONTEND_URL` sin cambiar | Cámbiala (paso 5) |
| Abrir `…/panel/entrar` directamente da 404 | Cloudflare no está sirviendo `index.html` para esa ruta | Revisa que el proyecto no tenga un `404.html`; avísame y lo vemos |
| La API tarda un minuto en responder | Render gratis despierta tras 15 minutos | Es lo esperado; con el plan de pago desaparece |
| `email failed ...` con *timed out* o *Network is unreachable* | El puerto 2587 también está bloqueado desde Render gratis | **Plan B**: cambiar el envío a la API HTTPS de Resend (puerto 443, que no se bloquea). Pídemelo y lo implemento |
| Error de autenticación al enviar | La clave de Resend es la equivocada o no basta "Sending access" | Crea otra con acceso completo y actualiza `EMAIL_HOST_PASSWORD` |
| `Error 403 ... You can only send testing emails to your own email address` | Intentas enviar a un correo que no es el de tu cuenta de Resend | Es el límite sin dominio; usa tu correo de Resend |
| Cada reserva tarda 10-20 segundos | El correo se envía dentro de la petición y su puerto está bloqueado (agota el tiempo) | Mismo plan B |

**Dónde mirar siempre:** Render → servicio → **Logs** (salida de la aplicación) y **Deploys** (construcción). Los correos que fallan quedan registrados con `email failed event=...`.

## Después de la prueba

- **Quitar la contraseña de las variables:** tras entrar por primera vez, cambia tu contraseña con "Olvidé mi contraseña" y borra `PLATFORM_ADMIN_PASSWORD` de Render. El sistema nunca la aplica sobre una cuenta que ya existe.
- **Cuando tengas dominio:**
  1. En Resend → **Domains → Add Domain**. Recomiendan un **subdominio** (por ejemplo `avisos.tudominio.pe`) en vez del dominio raíz. Elige la región más cercana a tus destinatarios.
  2. Copia al DNS los registros que te muestra (SPF y DKIM, de tipo TXT y MX o CNAME). **No actives el "proxy" (nube naranja de Cloudflare) en los CNAME de Resend.**
  3. La verificación suele tardar unos 15 minutos y puede tardar hasta 72 horas. DMARC se agrega después de verificar.
  4. Cambia `DEFAULT_FROM_EMAIL` a una dirección de ese dominio, y agrega el dominio a `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` y `ALLOWED_HOSTS`.
  5. Autorízalo en Google Cloud Console y sube `HSTS_SECONDS` solo cuando todo funcione por HTTPS.
- **Para clientes reales:** cambiar el servicio de Render a un plan de pago que no se duerma. **El precio actual no pude confirmarlo en la documentación** (la página de precios no mostró la tabla); mírala en render.com/pricing. Con un plan de pago desaparecen también el bloqueo de puertos de correo para el plan gratuito y el límite de 15 minutos.
- **Límites que vigilar en el plan gratuito:**
  - Render: 750 horas al mes por cuenta (un servicio encendido todo el mes cabe), y ancho de banda y minutos de construcción limitados (no pude ver la cantidad de ancho de banda).
  - Neon: 1 GB por proyecto y 100 horas de cómputo por proyecto al mes. Si se agotan, el cómputo se suspende hasta el mes siguiente; *"None of these limits delete your data"*. La página de regiones menciona que los proyectos gratuitos inactivos 90 días o más pueden eliminarse, sin dejar claro si aplica a todos: **usa tu proyecto con cierta regularidad**.
  - Resend: 100 correos al día y 3000 al mes, y 3 dominios. Los recibidos también cuentan. **(sin confirmar)** qué pasa en el plan gratuito al pasarse.

## Lo que se verificó antes de escribir esto

En una imagen idéntica a la que construye Render, ejecutada contra una base de datos vacía con variables de producción: arranca (migra, crea al administrador y levanta gunicorn); `check --deploy` de Django no da advertencias; el HTTP se manda a HTTPS salvo la revisión de salud; detrás del proxy responde con HSTS y cookies seguras; el admin carga con estilos; el administrador puede iniciar sesión; solo el frontend configurado puede llamar a la API; y la documentación interactiva queda oculta. Además, una cadena de conexión con el formato de Neon (con `sslmode` y `channel_binding`) es entendida por las librerías, y una prueba exige que el correo no use un puerto que Render bloquea.

Lo que **no** se puede verificar sin tus cuentas: que Neon acepte `btree_gist` con el rol por defecto, que el puerto 2587 salga desde Render gratis, que Render construya desde el repositorio, que Cloudflare resuelva las rutas, y la entrega de los correos.

## Fuentes consultadas (31 de octubre de 2026)

**Render:** [Blueprints](https://render.com/docs/infrastructure-as-code) · [Especificación del Blueprint](https://render.com/docs/blueprint-spec) · [Servicios gratuitos](https://render.com/docs/free) · [Variables de entorno](https://render.com/docs/environment-variables) · [Cambiar variables](https://render.com/docs/configure-environment-variables) · [Despliegues](https://render.com/docs/deploys) · [Registros](https://render.com/docs/logging) · [Servicios web](https://render.com/docs/web-services) · [Planes de cómputo](https://render.com/docs/compute-plans)

**Neon:** [Proyectos](https://neon.com/docs/manage/projects) · [Conectar desde cualquier aplicación](https://neon.com/docs/connect/connect-from-any-app) · [Pooling de conexiones](https://neon.com/docs/connect/connection-pooling) · [Regiones](https://neon.com/docs/introduction/regions) · [Escalar a cero](https://neon.com/docs/introduction/scale-to-zero) · [Planes](https://neon.com/docs/introduction/plans) · [Extensiones](https://neon.com/docs/extensions/pg-extensions) · [btree_gist](https://neon.com/docs/extensions/btree_gist) · [Roles](https://neon.com/docs/manage/roles)

**Cloudflare:** [Pages: integración con Git](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Configuración de construcción](https://developers.cloudflare.com/pages/configuration/build-configuration/) · [Imagen de construcción](https://developers.cloudflare.com/pages/configuration/build-image/) · [Cómo se sirven las páginas](https://developers.cloudflare.com/pages/configuration/serving-pages/) · [Encabezados](https://developers.cloudflare.com/pages/configuration/headers/) · [Límites](https://developers.cloudflare.com/pages/platform/limits/) · [Vistas previas](https://developers.cloudflare.com/pages/configuration/preview-deployments/) · [Workers: static assets](https://developers.cloudflare.com/workers/static-assets/) · [Migrar de Pages a Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)

**Resend:** [Enviar por SMTP](https://resend.com/docs/send-with-smtp) · [Crear una clave de API](https://resend.com/docs/create-an-api-key) · [Claves de API](https://resend.com/docs/dashboard/api-keys/introduction) · [Agregar un dominio](https://resend.com/docs/add-a-domain) · [Error 403 de resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) · [Cuotas y límites](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
