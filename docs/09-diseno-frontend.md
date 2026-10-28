# 09 - Diseño del frontend

> Dirección elegida: **boleto neobrutalista**. v0.2: ya implementada para el cliente (M6) y ajustada al verla en pantalla.

## 1. Concepto

**Reservar es sacar un boleto.** Todo el diseño sale de esa idea:

- La página de cada negocio es un **cartel**: un bloque grande de color con el nombre en tipografía enorme.
- Cada horario es una **entrada** que se toca y se hunde.
- La confirmación es un **boleto** con talón, perforación y código, que el cliente guarda.

Lo atrevido está en la forma (bordes gruesos, sombras duras, bloques planos, tipografía grande). El camino hacia el botón de reservar sigue siendo corto y obvio: la audacia nunca entorpece la tarea.

Se apoya en las referencias de [tendencias 2026](https://barnimages.com/blog/tips/web-design-trends/) (neobrutalismo con tipografía protagonista) y en la investigación de [selectores de fecha y hora](https://uxmovement.com/forms/the-best-mobile-ui-for-picking-date-and-time/) (sin selectores nativos, horario libre más cercano resaltado, botones grandes, datos personales después de elegir horario).

## 2. Por qué esta dirección encaja

| Condición del proyecto | Cómo responde el diseño |
|---|---|
| Sin imágenes en el MVP (D46) | Se sostiene con color, tipografía y forma; ningún negocio necesita fotos para verse bien |
| Canchas y psicólogos en la misma plataforma | Una sola estructura, y cada negocio elige su **color de acento** entre cinco |
| Se abre desde un link en WhatsApp o Instagram | Móvil primero, carga rápida, el negocio reconocible al instante |
| El cliente no tiene cuenta | "Mis reservas" guarda los boletos en el propio dispositivo |

## 3. Sistema visual

**Reglas de forma (una sola escala, sin excepciones):**

- Borde de **3 px** en tinta, en todo lo interactivo y en las tarjetas.
- Esquinas de **10 px** en todo. Ni píldoras ni cuadrados mezclados.
- Sombra **dura**, sin desenfoque: `4px 4px 0` en tinta. Al presionar, el elemento se desplaza hacia la sombra y esta se reduce a cero (efecto de botón físico).
- Sin degradados, sin brillos, sin transparencias decorativas.

**Color.** La tinta y el papel son fijos; el acento cambia por negocio.

| Acento | Bloque | Fondo de página | Profundo (texto sobre fondo claro) | Texto sobre el bloque |
|---|---|---|---|---|
| `lime` | `#C8F23C` | `#F2F9D0` | `#546F00` | tinta |
| `tangerine` | `#FF8A3D` | `#FFE9D6` | `#A84300` | tinta |
| `cobalt` | `#2F55F5` | `#E3E9FF` | `#1630A8` | blanco |
| `rose` | `#FF5C93` | `#FFE3EC` | `#A8103F` | tinta |
| `mint` | `#2EE6A6` | `#D9F8EC` | `#0B6F4D` | tinta |

Tinta: `#0E0F12`. El fondo de la página toma el tinte del acento del negocio, así cada página se siente distinta aun con la misma estructura. Los contrastes se verifican contra WCAG AA.

**Modo oscuro** (obligatorio): fondo casi negro, bordes en blanco roto, la sombra dura toma el color del acento. Sigue la preferencia del sistema.

**Tipografía** (autoalojada, sin enlaces a Google Fonts):

- Títulos: **Bricolage Grotesque**, muy pesada y apretada, grande.
- Texto: **Geist**.
- Horas, precios y códigos: **Geist Mono**.

Sin serifas, sin Inter. Los énfasis dentro de un título van en peso o inclinación de la misma familia.

**Iconos:** Phosphor, un solo grosor en toda la interfaz.

## 4. Pantallas

1. **Página del negocio** (`/:negocio`). Bloque de color con el nombre enorme, dirección y botón de WhatsApp. Debajo, la reserva en tres pasos en una sola pantalla que se desplaza:
   1. *Qué*: el servicio. Si el negocio ofrece uno solo, este paso no aparece.
   2. *Cuándo*: tira de 14 días con los días libres marcados y, debajo, los horarios como entradas. El primer horario libre llega ya resaltado.
   3. *Quién*: nombre, celular, correo opcional y aceptación de términos. Solo aparece cuando ya hay horario.
   Una barra fija abajo muestra el resumen y el botón **Reservar · S/ 60**.
2. **Boleto** (`/:negocio/reserva/:código`). La confirmación y también la pantalla de gestión: sello de estado (pendiente, confirmada, cancelada, vencida), datos, "Avisar por WhatsApp" con el mensaje ya escrito y cancelar con confirmación.
3. **Mis reservas** (`/mis-reservas`). Los boletos guardados en el dispositivo, con su estado actual.
4. **Inicio** (`/`) y **no encontrado**: breves, con la misma voz visual.

## 5. Movimiento

Solo donde comunica algo:

- Las entradas y botones **se hunden** al tocarlos (retroalimentación).
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

Capturas en celular de 390 px y en escritorio, en claro y en oscuro, con datos reales. Esto corrigió:

- **Etiqueta de precio sobre el título.** Pasó a la esquina inferior del cartel, con espacio reservado para que no tape los chips de contacto.
- **Títulos largos partidos a mitad de palabra** ("CONSULT/ORIO"). El tamaño del título ahora depende de la palabra más larga del nombre.
- **Sello de estado sobre el nombre del servicio.** Ahora va debajo del título, dentro del bloque de color.
- **Fechas con mayúsculas incorrectas** ("28 De Octubre"). Solo se capitaliza la primera letra.
- **Ancho de página mayor que la pantalla** por una columna de grilla sin límite. Las grillas de página fijan una sola columna en móvil.

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

## 10. Pendiente de decidir

- **Nombre del producto.** Se usa el nombre de trabajo **Separa** (en Perú "separar" una cancha es reservarla) hasta decidir (Q4). Cambiarlo es cuestión de un archivo de textos.
- Logotipo definitivo. Los iconos actuales parten de la marca provisional (una S en un sello).
- Si el modo oscuro necesita un botón manual además de seguir al sistema.
- Los selectores de hora del navegador siguen su idioma (algunos muestran AM/PM); si molesta, se puede reemplazar por un selector propio de 24 horas.
- Dividir el paquete de JavaScript por pantallas (hoy unos 485 KB, 152 KB comprimido).
- Si algún día hay fotos, el bloque de color puede llevar una imagen recortada dentro, sin cambiar el sistema.
