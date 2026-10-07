# Guía de uso — Pokemora

## ¿Qué es esta aplicación?

Pokemora es una Pokédex interactiva en español. Consulta especies, ilustraciones y datos desde [PokéAPI](https://pokeapi.co/). Permite encontrar Pokémon, filtrar y ordenar el índice, guardar favoritos y revisar una ficha con estadísticas y ventajas o debilidades por tipo.

Es un proyecto de aficionados, no oficial ni afiliado a The Pokémon Company o Nintendo. No necesitas crear una cuenta, iniciar sesión ni introducir datos personales.

## Abrir la Pokédex

1. Abre `outputs/index.html` en un navegador moderno, o visita la dirección HTTPS donde se haya publicado la carpeta `outputs`.
2. Espera a que el indicador muestre que el sistema está en línea y el índice termine de cargar.
3. Si no hay conexión con PokéAPI, revisa tu internet y selecciona **Reintentar**. No hace falta una clave API.

La primera carga necesita conectarse a PokéAPI. Los datos consultados se guardan localmente en el navegador durante un máximo de 24 horas para acelerar visitas posteriores.

## Buscar y explorar

- **Buscar espécimen / ID**: escribe un nombre o número de Pokédex. La búsqueda se aplica al nombre de API (por ejemplo, `pikachu`) y al número.
- **Generación**: limita el índice a una de las nueve generaciones disponibles, desde Kanto hasta Paldea.
- **Tipo**: muestra especies que PokéAPI asocia al tipo seleccionado.
- **Orden**: ordena por número ascendente o descendente, o por nombre A–Z o Z–A.
- **Páginas**: cada página presenta hasta 16 resultados. Usa **Anterior** y **Siguiente** para moverte.
- **Escaneo aleatorio**: abre la ficha de una especie seleccionada al azar del índice.
- **Atajo de búsqueda**: `Ctrl+K` en Windows/Linux o `⌘+K` en macOS enfoca la búsqueda.

Los filtros se pueden combinar. Si no aparecen resultados, borra el texto o cambia los filtros activos.

## Guardar y ver favoritos

Selecciona el corazón de una tarjeta para añadir o quitar esa especie de tus favoritos. **Ver favoritos** muestra únicamente los registros guardados; **Registros guardados** en la navegación lleva a ese mismo filtro. El contador indica cuántos favoritos hay.

Los favoritos se guardan en el almacenamiento local de ese navegador y dispositivo. No se sincronizan entre dispositivos ni se envían a un servidor. Si borras los datos del sitio en el navegador, perderás los favoritos guardados.

## Consultar la ficha

Selecciona una tarjeta para abrir la ficha. La ficha incluye, cuando PokéAPI dispone de ellos:

- Número, nombre localizado, categoría de especie y descripción. Se prefiere español; se utiliza inglés si falta el texto en español.
- Tipo o combinación de tipos, ilustración, altura, peso y experiencia base.
- Seis estadísticas base: PS, Ataque, Defensa, Ataque especial, Defensa especial y Velocidad.
- Habilidades disponibles, con las habilidades ocultas marcadas.
- **Reproducir sonido**, si existe un audio disponible.
- **Ventajas y riesgos**, calculados a partir de las relaciones de daño de tipo de PokéAPI.

### Interpretar ventajas y riesgos

En **ATACA**, cada sección describe lo que ocurriría al atacar con uno de los tipos de la especie. `2×` indica daño doble contra el tipo rival, `½×` daño reducido y `0×` inmunidad. Solo se muestran los tipos con daño distinto del normal; los rivales se consideran monotipo en esta sección.

En **DEFIENDE**, se agrupan los tipos de ataque según el daño que recibe esta especie. Si tiene dos tipos, se multiplican sus relaciones: por ejemplo, `4×` significa debilidad cuádruple y `¼×` resistencia de un cuarto. `0×` significa inmunidad.

Esta tabla analiza tipos, no movimientos particulares. No toma en cuenta poder o categoría de un movimiento, habilidades, objetos, clima, estadísticas, reglas de combate ni diferencias entre juegos. Es una guía de relaciones de tipos, no una predicción completa del resultado de una batalla.

## Cerrar la ficha y accesibilidad

- Usa **×** o `Escape` para cerrar la ficha.
- También puedes seleccionar el fondo exterior de la ficha.
- El foco de teclado se conserva al abrir y se devuelve al control anterior al cerrar. `Tab` y `Mayús+Tab` permanecen dentro de la ficha mientras está abierta.
- Los botones, campos y controles tienen etiquetas accesibles. La interfaz respeta la preferencia del sistema para reducir movimiento.

## Privacidad y solución de problemas

La aplicación no incluye cuentas, pagos, formularios ni analítica propia. Las consultas se hacen desde el navegador a PokéAPI; las ilustraciones y sonidos pueden cargarse desde los recursos oficiales de PokéAPI alojados en GitHub. El navegador conserva caché y favoritos localmente.

Si una ilustración o un audio no carga, la ficha y sus demás datos pueden seguir funcionando. Si no carga el índice o una ficha, comprueba tu conexión y reintenta. Una caída o limitación temporal de PokéAPI puede impedir la carga; esta aplicación no administra ese servicio.

Para errores del sitio, incluye en el reporte el navegador, el paso que estabas realizando y el mensaje visible. No compartas contraseñas, tokens ni información privada: esta aplicación no los necesita.

