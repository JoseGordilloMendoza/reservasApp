# 11 - Accesibilidad y lenguaje llano

> Decisión D109. El núcleo de MiReserva es que lo entienda y lo use cualquier persona: el dueño de una cancha que nunca usó un sistema de reservas, un cliente mayor, alguien con el celular viejo o con poca vista. Este documento dice qué nos comprometemos a cumplir, qué se comprobó y qué todavía no.

## 1. Lo que cumplimos en cada pantalla

| Compromiso | Cómo se cumple |
|---|---|
| **Se lee bien** | El texto tiene un contraste de al menos **4,5:1** con su fondo (el texto grande, 3:1). Todos los colores de la interfaz salen de una lista de valores ya medidos, en claro y en oscuro ([09 - Diseño](09-diseno-frontend.md), sección 3). El celeste y el azul de acento no se usan para texto porque no llegan a 4,5:1. |
| **Un color nunca dice algo solo** | Los estados llevan siempre la palabra (Confirmada, Pendiente, Con faltas, Sin pagar), no solo un color. Un día sin horarios lleva rayas, no solo un tono apagado. La reserva pendiente va con borde punteado y la palabra. |
| **Se toca bien** | Los botones y campos principales miden **44 px o más** de alto (los botones, 48; los campos, 52). El mínimo que exige WCAG 2.2 AA es 24 px, y la herramienta automática lo comprueba en todo. |
| **Se usa con teclado** | Todo lo que se toca se alcanza con Tab y se activa con Enter o Espacio. El foco siempre se ve: un contorno de 3 px en el azul de la marca. |
| **Se entiende con un lector de pantalla** | Los títulos siguen un orden, cada campo tiene su etiqueta escrita (nunca solo un texto de ayuda dentro), los íconos sin significado propio se ocultan y los que sí significan algo llevan nombre. Las listas de opciones son grupos de opciones reales. |
| **Respeta el movimiento** | Con "reducir movimiento" activado en el sistema, todas las animaciones se apagan. No hay nada que parpadee ni se mueva solo. |
| **Respeta el tamaño de letra** | Casi todo el texto usa unidades relativas, así que sigue el tamaño que la persona eligió en su celular. Unas pocas etiquetas diminutas (como "Próximo" sobre un horario) tienen tamaño fijo y se revisarán. |
| **Funciona en claro y en oscuro** | Sigue la preferencia del sistema, con los mismos contrastes en los dos. |
| **Los errores ayudan** | Cada error dice **qué pasó y qué hacer**, junto al campo, y se anuncia a los lectores de pantalla. En los formularios largos (reservar, abrir un negocio) el foco se lleva al primer campo que hay que corregir. |
| **No pide cuenta para lo básico** | Reservar y ver una reserva no necesitan registro ni contraseña. |

## 2. Lenguaje llano

El texto de la interfaz sigue estas reglas (también en [09 - Diseño](09-diseno-frontend.md), sección 6):

- **Español de Perú, tuteo, frases cortas.** Una idea por frase.
- **Palabras de todos los días.** "Reservar", no "agendar"; "Cancelar reserva", no "anular"; "Cuánto falta", no "saldo pendiente" a secas.
- **Cada botón dice una acción** y cabe en una línea: *Reservar*, *Avisar por WhatsApp*, *Confirmo que voy*.
- **Una misma cosa se llama siempre igual.** El lugar que se reserva es "espacio"; lo que se confirma es la "reserva"; lo que se muestra al llegar es el "código".
- **Se dice lo que va a pasar antes de pasar.** "Se abre el chat con el mensaje ya escrito. No se envía hasta que lo mandes tú."
- **Nada de jerga técnica ni de siglas** sin explicar. Ningún guion largo (—) en los textos.
- **Los textos legales y las reglas del negocio** se escriben igual de claro que lo demás.

## 3. Lo que se comprobó

**Con una herramienta automática** ([axe-core](https://github.com/dequelabs/axe-core), reglas WCAG 2.0, 2.1 y 2.2 de nivel A y AA), sobre siete pantallas en celular, en claro y en oscuro (14 combinaciones): inicio, página de un negocio (con sus características, reglas y redes), ingreso, inicio del panel, lista de reservas, reglas de reserva y "Mi página". **Resultado al 14 de noviembre de 2026: 0 problemas.** Incluye la comprobación de contraste.

Para repetirla, con la aplicación y los datos de ejemplo en marcha:

\`\`\`bash
cd tools/accessibility
npm install
npm run audit
\`\`\`

Termina con error si alguna pantalla tiene un problema, así que puede correr en una verificación automática antes de publicar. Cada pantalla nueva debería sumarse a la lista de \`audit.mjs\`.

**A mano:** el texto de los botones, los estados vacíos y los errores se revisaron al ver cada pantalla en el navegador.

## 4. Lo que todavía no se comprobó

Una herramienta automática encuentra una parte de los problemas, no todos. Falta:

- **Una prueba con un lector de pantalla real** (TalkBack en Android, VoiceOver en iPhone) recorriendo una reserva completa y el panel.
- **Una prueba con personas de verdad:** idealmente un dueño de negocio sin experiencia y un cliente mayor, reservando sin ayuda. Es lo que más nos diría sobre si de verdad es simple.
- **El contraste sobre los degradados.** La herramienta no puede medir texto sobre un degradado, así que se calculó a mano: blanco sobre los dos extremos del azul da 7,6:1 y 8,6:1. El texto en celeste claro (\`#BFE3FF\`) sobre ese azul no se midió con la herramienta.
- **Las pantallas que no están en la lista** (boleto con dirección y reglas, "Mis reservas", clientes, espacios, servicios, bloqueos, y toda el área del equipo).
- **Teléfonos muy pequeños y con letra muy grande**: se probó a 390 px de ancho.

## 5. Al crear o cambiar una pantalla

Antes de darla por terminada:

1. ¿Todo el texto tiene 4,5:1 o más? Usa solo los valores de la lista de colores.
2. ¿Lo que se toca mide 44 px o más y se alcanza con Tab?
3. ¿Cada campo tiene su etiqueta escrita y cada error dice qué hacer?
4. ¿Algún estado depende solo del color? Agrégale la palabra.
5. ¿El texto se entiende sin saber cómo funciona el sistema? Léelo como si fueras otra persona.
6. Corre \`npm run audit\` y suma la pantalla a la lista.
