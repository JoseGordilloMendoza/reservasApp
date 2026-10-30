# 10 - Despliegue de prueba (todo gratis)

> Para probar el flujo completo en internet sin gastar. **No es para clientes reales**: el servidor gratuito se duerme y los correos solo llegan a una dirección. Las decisiones están en [D82](02-decisiones.md) y las razones en [07 - Arquitectura](07-arquitectura.md), sección 7.

## Qué se monta

| Pieza | Servicio | Costo en la prueba |
|---|---|---|
| Base de datos | **Neon** (PostgreSQL) | Gratis |
| API (Django) | **Render**, servicio web | Gratis |
| Aplicación (React) | **Cloudflare Pages** | Gratis |
| Correo | **Resend** (ya tienes la clave) | Gratis |

```
 Cliente / dueño / equipo ──► Cloudflare Pages (la aplicación)
                                      │  llama a
                                      ▼
                              Render (la API) ──► Neon (la base de datos)
                                      │
                                      └──► Resend (correos)
```

## Lo que debes esperar de la prueba

- **El primer clic tras 15 minutos sin visitas tarda cerca de un minuto** (Render gratis se duerme). Es lo que justifica pasar a un plan de pago para clientes reales. La aplicación mostrará "Cargando" y funcionará sola cuando despierte.
- **Los correos solo llegan al correo con el que creaste tu cuenta de Resend**, porque aún no hay dominio. Para ver el flujo completo, usa ese mismo correo como dueño de prueba.
- **La base de datos de ejemplo no existe aquí** (`seed_demo` solo corre en desarrollo). Los negocios se crean desde el panel del equipo, que además es la mejor prueba del alta.
- **El acceso con Google probablemente no funcione todavía**: Google puede no aceptar una dirección `.pages.dev` como origen autorizado. Se prueba al final; si falla, se resuelve con el dominio propio.

## Antes de empezar

1. Tener a mano **tu correo de Resend** y **la clave de API** (la que usamos en `.env`). Como la pegaste en un chat, genera una nueva en Resend para el servidor, y apunta cuál es el correo de tu cuenta.
2. Haber subido el repositorio a GitHub (ya está en `JoseGordilloMendoza/reservasApp`).
3. Elegir una **contraseña larga** para el primer miembro del equipo (12 caracteres o más, no solo números): será `PLATFORM_ADMIN_PASSWORD`.

## Paso 1: la base de datos en Neon

1. Entra a [neon.com](https://neon.com) y crea un proyecto.
2. Elige la **región más cercana a Perú** que ofrezca (probablemente São Paulo; no lo he verificado, mira las opciones). La latencia entre la API y la base importa más que el resto.
3. Copia la **cadena de conexión** (`postgresql://usuario:clave@...`). Recomiendo la **directa** (la que no dice `-pooler` en el nombre del servidor), porque Django mantiene sus propias conexiones; es una recomendación mía, no verificada hoy en la documentación de Neon.
4. Asegúrate de que termine en `?sslmode=require`. Si no la trae, agrégalo.

Guarda la cadena: la pedirá Render como `DATABASE_URL`.

> La primera vez que arranque la API se crea la extensión `btree_gist` y la restricción que impide reservas solapadas. Neon dice soportarla (documentación oficial), pero **es lo primero que hay que verificar de verdad**: si falla, el registro del despliegue lo dirá con claridad.

## Paso 2: la API en Render

1. En [render.com](https://render.com): **New → Blueprint**, conecta tu cuenta de GitHub y elige el repositorio `reservasApp`.
2. Render lee `render.yaml` y te pide los valores que no están escritos en el archivo:

   | Variable | Qué poner |
   |---|---|
   | `DATABASE_URL` | La cadena de Neon del paso 1 |
   | `PLATFORM_ADMIN_EMAIL` | Tu correo (será el miembro del equipo) |
   | `PLATFORM_ADMIN_PASSWORD` | La contraseña larga que elegiste |
   | `EMAIL_HOST_PASSWORD` | La clave de API de Resend |
   | `CORS_ALLOWED_ORIGINS` | Por ahora cualquier valor temporal, como `https://ejemplo.pages.dev`; se corrige en el paso 4 |
   | `FRONTEND_URL` | Lo mismo: temporal hasta el paso 4 |
   | `GOOGLE_CLIENT_ID` | Déjalo vacío por ahora |

3. Pulsa **Apply**. Render construye la imagen y la inicia. El primer arranque tarda unos minutos.
4. Cuando termine verás la dirección del servicio, algo como `https://separa-api-xxxx.onrender.com`. Ábrela con `/api/health/` al final: debe responder `{"status":"ok","database":"ok"}`.

**Si algo falla**, el registro (pestaña *Logs* del servicio) lo dice. Lo más probable:
- `SECRET_KEY is required...`: no debería pasar, Render la genera.
- Error al conectar a la base: revisa `DATABASE_URL` y el `?sslmode=require`.
- `PLATFORM_ADMIN_PASSWORD is not acceptable`: la contraseña es débil o corta.
- Error al crear `btree_gist`: Neon no la permitió; avísame con el mensaje.

## Paso 3: la aplicación en Cloudflare Pages

1. En el panel de Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, y elige el repositorio.
2. Configura la construcción:

   | Campo | Valor |
   |---|---|
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

3. En *Environment variables* agrega:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://separa-api-xxxx.onrender.com/api/v1` (la dirección del paso 2, con `/api/v1`) |
   | `NODE_VERSION` | `22` |

4. Guarda y despliega. Obtendrás una dirección como `https://separa-xxx.pages.dev`.

> Cloudflare Pages sirve `index.html` para cualquier ruta si el proyecto no tiene un `404.html` (así lo describe su documentación, pero **no lo he comprobado**). Si al abrir `…/panel/entrar` directamente ves un error 404, es lo primero que hay que revisar.

## Paso 4: unir las dos partes

Vuelve a Render → el servicio → **Environment** y cambia:

| Variable | Valor |
|---|---|
| `CORS_ALLOWED_ORIGINS` | La dirección de Cloudflare, sin barra final: `https://separa-xxx.pages.dev` |
| `FRONTEND_URL` | La misma dirección |

Guarda: Render reinicia el servicio. Sin esto el navegador bloquea las llamadas a la API y los enlaces de los correos apuntarían mal.

## Paso 5: probar el flujo completo

Marca cada punto; lo que falle me lo cuentas con el mensaje que veas.

**Como equipo de la plataforma**
- [ ] Abrir `https://separa-xxx.pages.dev/panel/entrar` y entrar con `PLATFORM_ADMIN_EMAIL` y su contraseña → llega a **Plataforma**.
- [ ] **Nuevo negocio**: crear uno con *tu correo de Resend* como dueño, tipo cancha, 30 días de prueba.
- [ ] Llega un **correo de bienvenida** a ese correo, con el enlace para elegir contraseña.

**Como dueño del negocio**
- [ ] Elegir la contraseña con el enlace del correo y entrar al panel. (Mismo correo que el equipo: pueden ser la misma persona si usas dos navegadores o pestañas privadas.)
- [ ] En **Ajustes → Espacios y horarios**: crear una cancha y su horario semanal.
- [ ] En **Ajustes → Servicios**: crear un servicio con duración y precio.
- [ ] En **Ajustes → Mi página**: activar "Aparecer en el buscador" y guardar.

**Como cliente**
- [ ] En el inicio (`/`), **buscar el negocio por nombre** y entrar a su página.
- [ ] Reservar un horario con un nombre y un celular (y tu correo, para recibir el aviso).
- [ ] Llega el **correo de recibo** con el enlace del boleto, y el panel del dueño muestra la reserva **por confirmar**.
- [ ] Confirmarla desde el panel y ver el boleto cambiar de estado.

**Otras comprobaciones**
- [ ] **Olvidé mi contraseña** desde la pantalla de entrada: llega el correo y el enlace funciona.
- [ ] En **Plataforma → el negocio → Suscripción**: registrar un pago y ver la vigencia avanzar.
- [ ] **Entrar como soporte** al panel del negocio y terminarlo; mirar **Actividad**.
- [ ] Instalar la aplicación en el celular (menú del navegador → "Añadir a pantalla de inicio").
- [ ] Dejar la API 20 minutos sin visitas y medir cuánto tarda en abrir.

## Después de la prueba

- **Quitar la contraseña de las variables:** tras el primer ingreso, cambia tu contraseña con "Olvidé mi contraseña" y puedes borrar `PLATFORM_ADMIN_PASSWORD` de Render. El sistema nunca la vuelve a aplicar sobre una cuenta que ya existe.
- **Revisar los registros:** el servicio imprime en la consola cada correo que falla y cada error.
- **Cuando llegue el dominio:** verificarlo en Resend (SPF y DKIM), cambiar `DEFAULT_FROM_EMAIL`, agregar el dominio a `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` y `ALLOWED_HOSTS`, y autorizarlo en Google. Subir `HSTS_SECONDS` solo cuando todo funcione por HTTPS.
- **Para clientes reales:** pasar el servicio de Render a un plan de pago para que no se duerma. El precio actual se confirma en su página.

## Lo que se verificó antes de escribir esto

En una imagen idéntica a la que construye Render, ejecutada contra una base de datos vacía con variables de producción:

- Arranca: migra la base, crea al administrador y levanta gunicorn.
- La revisión de seguridad de Django (`check --deploy`) no da ninguna advertencia.
- Una visita en HTTP se manda a HTTPS, salvo la revisión de salud (que Render hace).
- Detrás del proxy responde con normalidad, con HSTS y cookies seguras.
- El admin de Django carga con sus estilos.
- El administrador creado puede iniciar sesión.
- Solo el frontend configurado puede llamar a la API desde un navegador.
- La documentación de la API (`/api/docs/`) queda oculta.

Lo que **no** se pudo verificar sin las cuentas reales: que Neon acepte `btree_gist` en la práctica, que Render construya desde el repositorio, que Cloudflare resuelva las rutas, y los correos hacia afuera.
