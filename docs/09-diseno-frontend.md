# 09 - Diseño del frontend

> Dirección elegida: **boleto neobrutalista**. Borrador v0.1, se ajusta al verla en pantalla.

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

## 8. Pendiente de decidir

- **Nombre del producto.** Se usa el nombre de trabajo **Separa** (en Perú "separar" una cancha es reservarla) hasta decidir (Q4). Cambiarlo es cuestión de un archivo de textos.
- Logotipo definitivo e iconos de la aplicación instalable.
- Si algún día hay fotos, el bloque de color puede llevar una imagen recortada dentro, sin cambiar el sistema.
