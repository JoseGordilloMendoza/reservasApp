# 09 - Diseño del frontend

> Dirección actual: **MiReserva, limpia y de confianza** (D106). Reemplaza al "boleto neobrutalista" (D47), que se construyó y se probó en internet antes de este cambio. El logo, los colores y el estilo vienen del moodboard que entregó el socio del proyecto.

## 1. Concepto

**Reservar debe sentirse claro, tranquilo y confiable**, para cualquier negocio y para cualquier persona. Tres reglas mandan sobre cualquier detalle:

- **Simple.** Una cosa por pantalla, frases cortas, botones que dicen una acción. Si algo necesita explicación, se rediseña.
- **Accesible.** Se lee bien, se toca bien y se entiende sin ayuda: contraste comprobado, botones grandes, teclado, lenguaje llano (ver [11 - Accesibilidad](11-accesibilidad.md)).
- **De confianza.** Azul, mucho aire, bordes finos y sombras suaves: parece una herramienta seria, que un consultorio o una clínica no tendrían reparo en mostrar.

El boleto con código sigue siendo la imagen de la confirmación: es lo que el cliente guarda y muestra. Ya no es el estilo de toda la aplicación.

Se apoya en las referencias de [selectores de fecha y hora](https://uxmovement.com/forms/the-best-mobile-ui-for-picking-date-and-time/): sin selectores nativos, horario libre más cercano resaltado, botones grandes y datos personales después de elegir horario.

## 2. Por qué esta dirección encaja

| Condición del proyecto | Cómo responde el diseño |
|---|---|
| Canchas, consultorios, clínicas y más en la misma plataforma | Una estructura neutra y de confianza, y cada negocio elige su **acento** entre seis |
| Se abre desde un link en WhatsApp o Instagram | Móvil primero, carga rápida, el negocio reconocible al instante |
| El cliente no tiene cuenta | "Mis reservas" guarda los boletos en el propio dispositivo |
| Las imágenes son opcionales (D120) | Se sostiene con color, tipografía y formas propias; el logo y la portada de cada negocio se suman sin cambiar el sistema, y sin ellos todo se ve igual |
| Una aplicación móvil vendrá más adelante | Los colores, la tipografía y los componentes ya salen de una misma lista de valores |

## 3. Sistema visual

**Marca.** El nombre es **MiReserva**, escrito en una sola palabra con "Mi" en tinta y "Reserva" en azul. El logo es una M cuya diagonal central es una palomita de confirmar. Está dibujado en vectores (`frontend/src/components/Logo.tsx`), y el favicon y los íconos de la aplicación (incluido el recortable de Android) salen de ese mismo dibujo.

**Colores de la marca** (del moodboard):

| Nombre | Valor | Uso |
|---|---|---|
| Primario | `#052FF7` | Botones principales, bloques de color, el acento por defecto. Blanco encima: 7,6:1 |
| Secundario | `#1238C9` | Enlaces, títulos de color, fin del degradado. Sobre el fondo: 6,9:1 a 7,9:1 |
| Acento | `#168BFF` | **Solo decoración** (3,4:1 con blanco: no sirve para texto) |
| Celeste | `#48B8FF` | **Solo decoración** (2,2:1 con blanco) |
| Fondo | `#EAF6FF` | Bloques suaves dentro de la página |
| Superficie | `#F5F9FF` | Fondo de la página |
| Texto | `#172B4D` | Todo el texto y la tinta oscura. Sobre blanco: 14,1:1 |

**Valores de uso** (cada uno comprobado en claro y en oscuro; los contrastes son contra el fondo donde se usan):

| Valor | Claro | Oscuro | Para qué |
|---|---|---|---|
| Página | `#F5F9FF` | `#0B1530` | Fondo |
| Tarjeta | `#FFFFFF` | `#12203F` | Superficie elevada |
| Texto | `#172B4D` | `#EAF1FF` | Lectura (12,8 a 15,9) |
| Texto secundario | `#53627E` | `#A9B8D6` | Ayudas y datos de apoyo (5,6 a 9,0) |
| Borde de tarjeta | `#D3E1F3` | `#26385F` | Separar (decorativo) |
| Borde de campo | `#7589AD` | `#5B739E` | Que un campo se vea (3,35:1 o más) |
| Aviso | `#C0182F` | `#FF7A8A` | Errores y faltas (5,8 o más) |

**Acentos por negocio.** Cada negocio elige uno; el resto de la interfaz no cambia (D87, D108). El predeterminado es el azul de la marca. Con los otros, el fondo de la página recibe un 8 % de su color.

| Acento | Color | Texto sobre el bloque | Texto chico sobre la página |
|---|---|---|---|
| `brand` (azul MiReserva) | `#052FF7` | blanco (7,6) | `#1238C9` (8,2) |
| `tangerine` (mandarina) | `#F2872C` | tinta (5,6) | `#A14A00` (5,7) |
| `sunflower` (girasol) | `#F5BD1F` | tinta (8,2) | `#7A5A00` (6,0) |
| `mint` (menta) | `#2FB98F` | tinta (5,7) | `#0B6A50` (6,2) |
| `sky` (cielo) | `#5FB4F0` | tinta (6,2) | `#14649C` (6,0) |
| `rose` (rosa) | `#F27BA4` | tinta (5,5) | `#A8164A` (6,9) |

**Forma** (una sola escala):

- Esquinas de **16 px** en tarjetas y bloques; **12 px** en botones, campos y etiquetas pequeñas; círculos para los números y las insignias de estado.
- Borde de **1 px** en un azul muy claro para tarjetas; los campos de formulario llevan un borde más marcado, porque deben verse.
- Sombra **suave**: una línea tenue y un halo largo y bajo. Al presionar, el elemento baja un pixel; al pasar el cursor, sube uno.
- Los bloques de color grande (la cabecera del inicio, el ingreso, el bloque para negocios) llevan un degradado del secundario al primario y los **elementos gráficos de la marca**: una palomita grande, una cápsula celeste y arcos finos, siempre a baja intensidad y detrás del texto.

**Tipografía** (autoalojada, sin enlaces a Google Fonts):

- **Inter** para todo: títulos en negrita, texto en regular y medio. Es una tipografía moderna, limpia y muy legible en pantallas.
- **Geist Mono** solo para horas, precios y códigos, porque su ancho fijo evita confundir cifras.

Los títulos van en minúscula y mayúscula normal, nunca todo en mayúsculas.

**Iconos:** Phosphor, un solo grosor en toda la interfaz.

**Modo oscuro** (obligatorio): azul muy oscuro de fondo y texto claro suave; los acentos conservan su color y el texto pequeño del acento se aclara. Sigue la preferencia del sistema.

## 4. Pantallas

1. **Página del negocio** (`/:negocio`). Bloque de color con el nombre enorme, dirección y botón de WhatsApp. Debajo, la reserva en tres pasos en una sola pantalla que se desplaza:
   1. *Qué*: el servicio. Si el negocio ofrece uno solo, este paso no aparece.
   2. *Cuándo*: tira de 14 días con los días libres marcados y, debajo, los horarios como entradas. El primer horario libre llega ya resaltado.
   3. *Quién*: nombre, celular, correo opcional y aceptación de términos. Solo aparece cuando ya hay horario.
   Una barra fija abajo muestra el resumen y el botón **Reservar · S/ 60**.
   Después de la reserva (en pantalla ancha, bajo el cartel) va **"Sobre este lugar"**: lo que tiene el lugar como etiquetas con ícono y nombre, el botón **Cómo llegar**, las **reglas de la casa** como lista y **Síguenos** con las redes. Es una tarjeta con la misma forma que el resto y no aparece si el negocio no llenó nada. Los links salen en pestaña nueva y se anuncian así a un lector de pantalla.
2. **Boleto** (`/:negocio/reserva/:código`). La confirmación y también la pantalla de gestión: sello de estado (pendiente, confirmada, cancelada, vencida), datos, dónde queda con "Cómo llegar", las reglas ("Antes de venir"), "Avisar por WhatsApp" con el mensaje ya escrito y cancelar con confirmación.
3. **Mis reservas** (`/mis-reservas`). Los boletos guardados en el dispositivo, con su estado actual y, si el cliente pidió recordarlos, una tarjeta **Mis datos** con el botón "Olvidar mis datos".
4. **Inicio** (`/`) y **no encontrado**: breves, con la misma voz visual.

## 5. Movimiento

Solo donde comunica algo:

- Los botones y los horarios **se hunden un pixel** al tocarlos y suben uno al pasar el cursor (retroalimentación).
- El boleto **se imprime** al confirmar: entra deslizándose con un resorte (el cambio de estado, mostrado).
- Los bloques de la página **entran escalonados** al cargar (jerarquía).
- Todo se desactiva con `prefers-reduced-motion`.

No hay marquesinas, parallax ni animaciones infinitas.

## 6. Reglas de contenido

- Español de Perú, tuteo, frases cortas. Ningún guion largo (—) en los textos de la interfaz.
- Los botones dicen una acción y caben en una línea (*Reservar*, *Cancelar reserva*, *Avisar por WhatsApp*).
- Una misma intención usa siempre la misma etiqueta.
- Todos los estados están diseñados: carga (esqueletos con la forma final), vacío, error y sin horarios.
- Los mensajes de error de reglas vienen del servidor en español y se muestran tal cual.

## 7. Tecnología

React, Vite y TypeScript; Tailwind v4 con variables CSS para los tokens; Motion para el movimiento; React Router; TanStack Query para los datos; Phosphor para iconos; Vitest para las pruebas. PWA instalable. Las rutas y el diseño se prueban en móvil primero.

## 8. Qué se aprendió al verlo en pantalla

> Esta sección y las siguientes recogen lo aprendido con el diseño anterior. Las lecciones de comportamiento (desbordes, foco, contenido) siguen vigentes; donde mencionan bordes gruesos, sombras duras, mayúsculas o inclinaciones, rige la sección 3.

Capturas en celular de 390 px y en escritorio, en claro y en oscuro, con datos reales. Esto corrigió:

- **Etiqueta de precio sobre el título.** Pasó a la esquina inferior del cartel, con espacio reservado para que no tape los chips de contacto.
- **Títulos largos partidos a mitad de palabra** ("CONSULT/ORIO"). El tamaño del título ahora depende de la palabra más larga del nombre.
- **Sello de estado sobre el nombre del servicio.** Ahora va debajo del título, dentro del bloque de color.
- **Fechas con mayúsculas incorrectas** ("28 De Octubre"). Solo se capitaliza la primera letra.
- **Ancho de página mayor que la pantalla** por una columna de grilla sin límite. Las grillas de página fijan una sola columna en móvil.
- **La página saltaba hacia abajo al abrirse** cuando algo alto quedaba sobre el selector de días (se vio al poner una portada). El selector usaba `scrollIntoView`, que mueve toda la página; ahora solo mueve su propia franja, de lado.

Estas reglas quedan para los próximos diseños: ninguna etiqueta flotante puede tapar texto, y todo título debe probarse con el nombre más largo posible.

## 9. El panel del negocio

Misma identidad (bordes, sombras, tipografía, color del negocio), pero con otra prioridad: **rapidez de uso**, no primera impresión.

- **Lo urgente primero.** El inicio abre con "Por confirmar" (con su cuenta) y "Hoy". Cada reserva pendiente trae lo necesario para responder sin abrirla: quién, cuándo, hasta cuándo se mantiene el horario y cómo contactar al cliente con un toque (llamar o WhatsApp).
- **Navegación según el dispositivo.** Pestañas fijas abajo en el celular (Inicio, Anotar, Reservas), con "Anotar" como la más llamativa porque es la acción principal; barra lateral en pantallas grandes. El contenido se limita a unos 46 rem de ancho para que las tarjetas no se estiren.
- **Confirmar es un toque; lo irreversible pregunta.** Rechazar y cancelar piden una segunda confirmación en el mismo lugar.
- **El estado siempre es una palabra** (sello), nunca solo color.
- **El panel toma el color del negocio**, igual que su página pública.
- **Anotar una reserva** termina con el enlace del cliente y un mensaje de WhatsApp ya escrito, porque el cliente que llamó no tiene cómo recibir su boleto de otra forma.

Segundo tramo del panel (clientes, bloqueos y ajustes):

- **Cuatro pestañas en el celular.** Clientes, bloqueos y ajustes viven en "Más"; en escritorio, en la barra lateral junto a lo demás.
- **Avisar sin cancelar.** Al bloquear un horario, las reservas que ya estaban ahí se muestran en un aviso con enlace a cada una; el sistema no las cancela por el dueño.
- **Formularios con eco legible.** Las reglas muestran lo escrito en lenguaje natural ("120" se lee "2 h", "1440" se lee "1 día") y se validan con los mismos límites que el servidor antes de enviar.
- **Horario semanal por día.** Cada día se abre o se cierra, admite varios tramos, se puede copiar a todos los días y avisa de solapes; 00:00 al cierre es medianoche.
- **Color con muestra propia.** Cada muestra lleva su acento, y al guardar todo el panel se repinta.
- **Lo irreversible pide confirmación**, y si el servidor lo rechaza (un espacio con reservas) el mensaje propone desactivar.
- **Se midió el ancho en el celular.** Dos pantallas se salían de la pantalla por una columna de grilla sin límite (la ficha del cliente y el editor de horario); ahora toda grilla de página usa una sola columna que no crece.

Recuperar la contraseña (dos pantallas con la misma cabecera de color de la entrada):

- **Pedir el enlace** no confirma si la cuenta existe: dice "si tiene una cuenta, te enviamos un enlace" para cualquier correo, y ofrece mirar en spam.
- **Elegir la contraseña** valida lo básico antes de enviar (8 caracteres, no solo números, repetirla) y deja que el servidor juzgue el resto, mostrando su mensaje bajo el campo.
- **Un enlace vencido, usado o incompleto** no muestra un formulario inútil: lo dice y ofrece pedir otro.
- Los títulos largos ("CONTRASEÑA") se reducen en celular para no desbordar; la misma regla de la sección 8.

## 10. El área del equipo de la plataforma

La misma identidad que el panel del negocio, pero con la prioridad de quien administra muchos negocios: ver qué requiere atención y actuar sin buscar.

- **Lo urgente primero.** El inicio abre con los negocios que vencen esta semana, están en gracia o suspendidos, y después los números (activos, cobrado y esperado del mes, reservas) y el desglose de suscripciones, cada fila con enlace a la lista ya filtrada.
- **Pestañas en el celular:** Inicio, Nuevo (la acción principal, la más llamativa), Negocios y Actividad; barra lateral en pantallas grandes.
- **El estado es una palabra en un sello** (Vigente, Vence en 3 días, En gracia, Vencida, Suspendido, Sin suscripción), nunca solo color; suspendido manda sobre lo demás.
- **La ficha de un negocio** se divide en Resumen, Suscripción y Personas, con la sección en la dirección para poder enlazarla.
- **Registrar un pago es el camino corto:** el monto llega con el precio acordado, un mes y Yape; casi siempre basta un toque. Mover la vigencia a mano, en cambio, pide explicar por qué.
- **Lo delicado pregunta:** suspender pide un motivo, quitar a alguien pide confirmar, y entrar como soporte pide por qué.
- **Soporte con una barra que no se puede ignorar:** negra, fija arriba, dice en qué negocio se está y hasta cuándo, con un botón siempre a mano para terminar. En el celular se acorta. Si la sesión vence, el panel sale solo.
- **Anchos:** una regla global da una columna que puede encogerse a toda cuadrícula sin columnas propias. Antes, una fila con texto que no se parte (`truncate`) ensanchaba la página más que el celular, y se corregía pantalla por pantalla; ahora se comprobaron 22 pantallas a 390 px exactos.
- **Una página nueva abre arriba**, no donde estaba la anterior.

## 11. El inicio y su buscador

> Desde D85 el negocio aparece por defecto, y desde D86 el inicio también lista negocios.

- **Titular genérico.** "Reserva tu hora. Sin llamadas." y, debajo, "Canchas, consultorios y más". El primer titular hablaba solo de canchas y la plataforma sirve a más rubros.
- **Buscar es opcional para el negocio y simple para el cliente.** Una caja que espera a que se deje de escribir (no pide en cada letra), pide 2 letras, y muestra nombre, tipo y dirección de cada resultado. Si no hay coincidencias lo dice, y debajo siempre queda el recordatorio de pedirle su link al negocio.
- **El dueño decide** si aparece, con una casilla en "Mi página" que explica qué significa.

### El camino de los negocios

- **Un bloque azul al final del inicio**, con los elementos gráficos de la marca, el titular "¿Tienes un negocio con citas?" y sus botones: "Escríbenos por WhatsApp" (blanco sólido), "Escríbenos por correo" y "Ya tengo cuenta" (con borde blanco). Cada contacto aparece solo si está configurado; sin ninguno, queda solo "Entrar a mi panel".
- **Un enlace discreto en el pie** ("Soy un negocio"), para quien busca dónde entrar y no llegó al final de la página.
- El contacto se configura al compilar el frontend: `VITE_CONTACT_WHATSAPP` (un celular peruano de 9 dígitos se completa con el 51) y/o `VITE_CONTACT_EMAIL`. Ambos mensajes salen con el pedido ya escrito. El correo es solo un borrador que la persona envía: no usa claves ni permisos. En el celular abre su app de correo; en una computadora, que casi nunca tiene una configurada, abre Gmail en la web, y debajo se muestra la dirección por si usa otro correo.

### La composición del inicio

(D121, a partir de la referencia del diseñador.)

- **Una cabecera azul con degradado** que contiene el titular, **la tarjeta de búsqueda** y el botón "Mis reservas". Al lado (debajo en el celular) va una **ilustración isométrica**: una plataforma con una cancha, un calendario y un celular con una reserva en pantalla, y dos tarjetas de ejemplo que flotan suavemente ("Reserva confirmada", "Cancha 1 · 60 min"). Todo eso es decoración: un lector de pantalla lo salta, y sin "reducir movimiento" las tarjetas suben y bajan unos pixeles.
- **Cuatro promesas** en tarjetas con un ícono sobre un acento distinto: sin cuenta, sin llamadas, boleto al instante, sin cobros extra. **Nunca cifras, estrellas ni distancias** mientras no sean reales.
- **Lista de negocios** como tarjetas: arriba **la portada** (o, si no hay, el dibujo plano del rubro sobre un fondo que alterna), **el logo montado en su borde** (o la inicial en el color del negocio), una etiqueta con el tipo, el nombre, la descripción, la dirección y un botón **"Reservar aquí"** en el color del negocio. Cada tarjeta lleva el acento de su negocio. Encima, botones para **ver por tipo** (canchas, psicólogos, otros), cada uno con su color, que solo aparecen si hay más de un tipo y solo con los tipos que tienen negocios. Se oculta sola si no hay ninguno.
- **"Así de fácil":** tres tarjetas, cada una con su ícono sobre un acento (buscar, calendario, boleto) y un círculo suave del mismo color en la esquina: elige, reserva, llega.
- **La franja para negocios** suma una tiendita isométrica.
- **Las ilustraciones son provisionales** (`components/IsoArt.tsx`, dibujadas con una pequeña proyección isométrica). Se reemplazan por las del diseñador cuando lleguen.
- **Colores por elemento.** Un elemento con `data-accent` toma ese acento para `bg-accent`, `text-on-accent` y `bg-accent-soft` (un lavado del 18%). **No usar `text-accent-deep` dentro de él**: ese tono se calcula para la página y en modo oscuro no se leería.

### Lo que el cliente guarda en su celular

- **Favoritos.** Un botón entre los datos del cartel del negocio: "Guardar en favoritos" y, ya guardado, "En tus favoritos" con el corazón lleno. El estado se dice con palabras, no solo con el relleno del ícono, y se anuncia a un lector de pantalla al tocarlo. En el inicio, una sección "Tus favoritos" (solo si hay alguno) entre la cabecera y la lista de negocios: una tarjeta por negocio con su inicial en el color que eligió, el tipo, el nombre y la dirección, y una **X** de 44 px para quitarlo.
- **Recordar mis datos.** En el paso "¿A nombre de quién?", si hay datos guardados, un recuadro punteado dice "Usamos los datos que guardaste en este celular" con "Usar otros datos". Una casilla "Recordar mis datos en este celular" va **antes** de la de los términos, que siempre empieza vacía.
- Todo es del celular de la persona (D115, D116, RN-88 a RN-92); la copia de la lista vive en `separa.favorites.v1` y la de los datos en `separa.me.v1`.

### Imágenes del negocio

- **Portada.** Una **franja de proporción 5:2** que sube al borde superior del cartel, con las esquinas de arriba redondeadas y una línea fina que la separa del color. **Nada se escribe encima**: el nombre y los textos siguen sobre el color sólido, así su contraste no depende de la foto (RN-98). Si la foto no carga, la franja desaparece.
- **Logo.** Un cuadrado blanco de 64 px (80 en escritorio) sobre el color, justo encima del nombre, con la imagen entera (sin recortar) y un pequeño margen para que un logo con fondo transparente se lea. En la tarjeta del inicio **reemplaza el dibujo**, y en los favoritos, la inicial de color. Sin logo, o si no carga, vuelve lo de antes.
- **Texto alternativo vacío** en las dos, porque el nombre está al lado y un lector de pantalla no tiene que repetirlo.
- **En el panel**, "Mi página" tiene una sección **Imágenes** con una vista previa de cada una, **Subir**/**Cambiar** y **Quitar**. Cada una se guarda sola, sin el botón de abajo. Antes de enviar se avisa si el archivo pesa más de 8 MB o no es JPG, PNG o WebP; el resultado se anuncia ("Logo guardado") y los errores salen como alerta.

### Confianza en quien reserva

- **Para el cliente, opcional y sin presión:** en el paso "¿A nombre de quién?" hay un recuadro punteado con "Continuar con Google" y una línea que explica para qué ("el negocio sabe que eres tú y puede confirmarte más rápido"). Si lo usa, se llenan su nombre y su correo, y el correo queda fijo.
- **Para el dueño, una señal en cada reserva pendiente:** una etiqueta (verificado con Google, cliente conocido, primera vez o con faltas) y una línea con lo que hizo antes. La de "primera vez" va punteada, la de "con faltas" en el color de aviso.
- **"Era una broma"** es un botón al final de cada reserva pendiente, con confirmación porque bloquea al cliente. En las listas solo se marca a quien tiene faltas.
- En Reglas hay tres maneras de confirmar: a mano, solo clientes de confianza, o todas solas; y los límites de quien aún no es de confianza.

### Los dos lados de una reserva, sin agobiar

- **En el boleto del cliente:** el día antes aparece un botón "Confirmo que voy". Al tocarlo, el boleto dice "Avisaste que vas. El negocio te espera a las 22:00" y el botón desaparece. No pide nada más.
- **En el panel del dueño:** la reserva dice "Avisó que va (17:37)", o en rojo "Todavía no avisa que va". En las listas se marca "Confirmó que va" o "Sin confirmar" solo para lo que ocurre en las próximas 24 horas, para no llenar de avisos lo demás.
- **"Escribirle por WhatsApp":** debajo de las acciones de la reserva, uno a tres botones según la situación (recordar, cómo pagar, no pude confirmar). Cada uno abre el chat con el mensaje listo, y una línea aclara que no se envía hasta que lo mande el dueño.

### Rapidez en los primeros segundos

- **La segunda visita no espera al servidor.** La lista del inicio y la página de un negocio aparecen al instante con lo último que se vio, y se actualizan solas cuando llega la respuesta nueva (D96). Nada de esto se nota salvo que el servidor esté dormido.
- **Lo que cambia con el minuto no se guarda:** horarios libres, reservas y todo el panel se piden siempre al servidor.

## 12. Pendiente de decidir

- **Nombre del producto.** Es **MiReserva** (D107); falta la consulta en INDECOPI (Q4).
- **El logo en vector original.** El que usa la aplicación está redibujado a partir de una imagen; conviene reemplazarlo por el archivo vectorial del diseñador y las variantes del ícono.
- Si el modo oscuro necesita un botón manual además de seguir al sistema.
- Los selectores de hora del navegador siguen su idioma (algunos muestran AM/PM); si molesta, se puede reemplazar por un selector propio de 24 horas.
- Las fotos por espacio y una galería (D120 las deja fuera por ahora): habría que decidir dónde se ven al elegir el espacio.
