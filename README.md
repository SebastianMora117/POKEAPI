# Pokemora // Pokédex táctica

## Documentación

- [Guía de uso](GUIA_USUARIO.md): búsqueda, filtros, favoritos y consulta de fichas.
- [Documentación técnica](DOCUMENTACION_TECNICA.md): arquitectura, API, cálculos de tipos, seguridad, mantenimiento y publicación.

## Separación MVC

- `outputs/index.html`: estructura y contenido de la vista.
- `outputs/assets/pokedex.css`: estilos de la interfaz.
- `outputs/src/model.js`: acceso a PokéAPI, validación y normalización de datos, caché local y favoritos.
- `outputs/src/view.js`: creación y actualización de nodos DOM.
- `outputs/src/controller.js`: eventos, filtros, paginación y coordinación de modelo y vista.

Abre `outputs/index.html` directamente o publica completa la carpeta `outputs`. Se usan scripts clásicos propios en orden MVC para conservar compatibilidad con una página estática sin compilación ni claves API.

## Protecciones incluidas

- CSP sin scripts, estilos ni eventos en línea. Solo se permiten peticiones a `pokeapi.co` e imágenes y audio en las rutas oficiales de `raw.githubusercontent.com`.
- Las respuestas se limitan por tamaño y tiempo, se validan por estructura, tipo, ID y ruta de recurso. Se usa `GET`, no se envían cookies ni credenciales, y se rechazan redirecciones.
- La vista nunca interpreta texto remoto como HTML: genera nodos DOM y asigna contenido con `textContent`. Las URLs de imágenes y audio pasan por una lista permitida estricta.
- Los datos de PokéAPI se cachean durante 24 horas, la caché tiene un límite de almacenamiento y las consultas simultáneas se agrupan. La carga de fichas limita la concurrencia a seis.
- Favoritos y caché quedan en el almacenamiento local del navegador; no hay registro, formularios, contraseñas, pagos ni datos personales.
- El diálogo controla el foco y el teclado; se declara una política de no referencia y se respeta `prefers-reduced-motion`.
- Las fichas consultan la matriz `damage_relations` de los 18 tipos. Calculan ataque por cada tipo propio contra rivales monotipo, y defensa contra cada tipo de ataque combinando correctamente los tipos dobles de la especie. La matriz se cachea para no repetir consultas. No se evalúan movimientos concretos ni habilidades.

La meta CSP protege al abrir el HTML directamente. `outputs/_headers` añade encabezados HTTP de defensa en profundidad para alojamientos estáticos que admiten ese formato, como Netlify y Cloudflare Pages. Publica todo el contenido de `outputs`, no solo `index.html`. En otro proveedor, configura encabezados equivalentes en el panel del proveedor. Usa HTTPS en producción para proteger el transporte; HSTS se aplica desde el encabezado de alojamiento.

Esta es una interfaz cliente estática; no puede asegurar el navegador o dispositivo del visitante, la cuenta del proveedor, el dominio ni una futura API de backend. Los encabezados configurados por el alojamiento y la seguridad operacional siguen siendo necesarios para publicar el sitio.

