# Documentación técnica — Pokemora

## 1. Descripción y alcance

Pokemora es una aplicación web estática, cliente y sin compilación, que consume la API pública REST v2 de PokéAPI. La interfaz está en español y presenta un índice de especies, filtros, favoritos, fichas de datos y una tabla de efectividad de tipos. No existe servidor propio, cuenta de usuario, base de datos remota, pago o integración con credenciales.

La aplicación cubre las especies de la Pokédex Nacional recibidas del índice de PokéAPI, hasta el límite defensivo de 2.000 entradas. Los selectores de generación representan las generaciones I–IX, con rangos de ID nacionales 1–1.025. Los datos y recursos dependen de la disponibilidad y contenido de PokéAPI.

## 2. Estructura del proyecto

```text
README.md
GUIA_USUARIO.md
DOCUMENTACION_TECNICA.md
outputs/
  index.html                 estructura HTML, CSP meta, nombre y carga MVC
  assets/pokemora-logo.svg   logo propio y favicon
  _headers                   encabezados HTTP para proveedores compatibles
  assets/pokedex.css         estilos, diseño adaptable, estados y tipos
  src/model.js               acceso/validación de datos, caché y favoritos
  src/view.js                creación y renderizado del DOM
  src/controller.js          estado de interfaz, eventos y coordinación
```

La separación MVC es una organización de código dentro de scripts de navegador clásicos:

- **Modelo** (`src/model.js`): comunica con PokéAPI, valida y normaliza respuestas, administra cachés y favoritos, y valida rutas de medios.
- **Vista** (`src/view.js`): construye nodos con APIs del DOM; presenta tarjetas, diálogo, estados, paginación y efectividades.
- **Controlador** (`src/controller.js`): enlaza eventos, mantiene filtros/página, solicita registros y coordina modelo y vista.

Los scripts se cargan con `defer` en el orden modelo → vista → controlador. No hay bundler, paquete npm ni configuración de build.

## 3. Ejecución local

Requisitos: navegador moderno con JavaScript habilitado y conexión a Internet para consultar PokéAPI. No hacen falta Node.js, npm, cuenta o clave API.

1. Abre `outputs/index.html` en el navegador. Si las políticas de tu entorno restringen solicitudes desde `file://`, sírvelo desde un servidor HTTP local estático.
2. Alternativamente, sirve la carpeta `outputs` con cualquier servidor estático local.

La página no usa endpoints de backend propios. No se debe insertar una clave secreta: la API utilizada es pública y no requiere clave.

## 4. Integración de PokéAPI

Raíz: `https://pokeapi.co/api/v2/`.

| Recurso | Uso |
|---|---|
| `pokemon-species?limit=2000` | Índice principal: ID y nombre de especie. |
| `pokemon-species/{id}` | Nombre localizado, género de especie y entradas de descripción. |
| `pokemon/{name}` | Tipos, estadísticas, habilidades, dimensiones, experiencia, sprites y audio. |
| `type/{type}` | Filtro de miembros del tipo y relaciones `damage_relations`. |

La aplicación carga primero el índice. Para cada tarjeta visible solicita los datos de la especie y Pokémon; la concurrencia de la página se limita a seis solicitudes de registros. El filtro de tipo obtiene sus miembros desde el recurso `type`. Al abrir una ficha, `loadTypeChart()` obtiene los 18 recursos de tipo con hasta seis solicitudes simultáneas y los reutiliza en memoria mientras viva la página.

Las solicitudes son `GET`, con `credentials: omit`, `redirect: error`, `referrerPolicy: no-referrer`, modo CORS, `Accept: application/json` y un límite de espera de 15 segundos. Se requieren respuestas HTTP satisfactorias con `Content-Type` JSON; la respuesta se limita a 1.500.000 caracteres, además de límites estructurales por colección y registro.

## 5. Cálculo de efectividad de tipos

El modelo valida los 18 nombres de tipo y copia `double_damage_to`, `half_damage_to`, `no_damage_to`, `double_damage_from`, `half_damage_from` y `no_damage_from`.

- **Ataque (`ATACA`)**: por cada tipo propio de la especie calcula el multiplicador contra cada tipo defensor individual. Agrupa y muestra solo relaciones no neutrales. No combina un segundo tipo del rival; la nota de la ficha lo declara.
- **Defensa (`DEFIENDE`)**: por cada tipo de ataque combina multiplicadores frente a todos los tipos de la especie. En inmunidad el resultado permanece en cero; de lo contrario los factores 2 o 0,5 se multiplican. Así se representan también debilidad/resistencia dobles o cuádruples.
- Los valores mostrados incluyen `0×`, `¼×`, `½×`, `1×`, `2×` y `4×` cuando corresponde.

Es un cálculo de relaciones de tipos de la API, no un simulador de combate. No considera movimientos, habilidades, objetos, clima, estadísticas ni reglas específicas de una entrega de Pokémon.

## 6. Estado, caché y privacidad

- Índice LRU en memoria con máximo de 100 respuestas; solicitudes idénticas en curso se agrupan para evitar duplicados.
- `localStorage` almacena caché de respuestas por 24 horas bajo `dex:v2:`. Una respuesta individual mayor de 180.000 caracteres no se persiste; la caché se limita aproximadamente a 1.800.000 caracteres/bytes reportados por el navegador y 80 entradas. Si el almacenamiento está deshabilitado o lleno, se conserva caché en memoria.
- Favoritos en `dex:favorites:v2`, como lista de IDs enteros. No se envían al servidor.
- No se recopilan ni transmiten datos de cuenta o personales. Las llamadas a PokéAPI y la carga de recursos externos sí revelan al servicio externo la conexión habitual del navegador (por ejemplo, dirección IP); la política de privacidad de PokéAPI y del alojamiento externo se aplica a sus servicios.
- Borrar los datos del sitio del navegador elimina caché y favoritos de ese navegador.

## 7. Controles de seguridad

### Validación y manejo de datos

- URLs API resueltas contra un origen fijo, `https://pokeapi.co`, y rutas bajo `/api/v2/`; los nombres se restringen con `^[a-z0-9-]{1,80}$`.
- IDs, recuentos de arrays, tipos, estadísticas, habilidades, alturas, pesos, contenido y tamaño de respuesta se validan o limitan antes de usarlos.
- El nombre/descripcion procedente de API no se interpreta como HTML. La vista crea elementos y asigna texto con `textContent`/nodos de texto; no usa `innerHTML`.
- Imágenes y sonidos requieren HTTPS, host `raw.githubusercontent.com`, sin credenciales/puerto/query/hash y rutas que coincidan con patrones esperados de sprites o cries de PokeAPI.
- Las solicitudes no envían cookies o credenciales, no siguen redirecciones, tienen timeout y se limitan en tamaño y concurrencia.

### Políticas de navegador y alojamiento

`index.html` define una CSP meta con `default-src 'self'`, scripts y estilos locales, conexión solo a `pokeapi.co`, imágenes/audio locales o desde `raw.githubusercontent.com`, sin formularios, plugins, marcos ni workers. Incluye `Referrer-Policy: no-referrer`.

`outputs/_headers` declara encabezados HTTP para alojamientos compatibles con este formato (por ejemplo, Netlify/Cloudflare Pages): CSP, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` y HSTS. La CSP del alojamiento agrega `frame-ancestors 'none'`, que no se puede imponer desde una meta CSP. Configura las reglas equivalentes en el panel del proveedor si este no procesa `_headers`.

**Límites:** los encabezados de `_headers` solo surten efecto si el host los soporta; el archivo por sí solo no activa HTTPS ni protege la cuenta, dominio, navegador o dispositivo del usuario. Publica mediante HTTPS. HSTS debe enviarse desde el servidor/host, no desde la meta CSP. En desarrollo sobre HTTP no se debe asumir que HSTS está aplicado. Una futura API propia requeriría revisión de seguridad específica para servidor, autenticación, CORS, almacenamiento y secretos.

## 8. Publicación estática

1. Publica el **contenido completo de `outputs/`** como raíz del sitio; debe quedar `index.html` en la raíz pública, junto con `assets/`, `src/` y `_headers`.
2. Usa un proveedor HTTPS de contenido estático. Netlify y Cloudflare Pages admiten el formato `_headers`; en otros proveedores configura los encabezados manualmente. No publiques solo `index.html`, porque faltarán estilos y scripts.
3. En esta fase no hay variables de entorno, secretos, paso de build ni instalación de dependencias.
4. Comprueba una carga inicial, búsqueda, cambio de generación/tipo, orden, paginación, favoritos, apertura/cierre de ficha y matriz de efectividad. Revisa que imágenes/audio permitidos carguen y que un fallo de API presente el mensaje de reintento.

El README puede apuntar al repositorio; la URL del sitio depende de la configuración del proveedor y del dominio elegido.

## 9. Mantenimiento y resolución de problemas

- **Índice vacío/error de conexión**: confirmar acceso HTTPS a `pokeapi.co`, JavaScript activo y consola del navegador; después usar **Reintentar**.
- **Filtro de tipo o matriz no disponibles**: confirmar acceso al recurso `/api/v2/type/{type}`. La matriz se vuelve a solicitar cuando se abre la ficha siguiente si no se pudo completar.
- **Imagen/audio ausente**: comprobar disponibilidad del archivo y acceso a `raw.githubusercontent.com`; los datos de texto no dependen de que cargue el medio.
- **Datos aparentemente antiguos**: `localStorage` puede conservarlos 24 horas; al borrar datos del sitio se invalida la caché.
- **Cambios de PokéAPI**: actualizar las validaciones conforme al esquema oficial y revisar límites/patrones de sprites, sin aceptar rutas de host arbitrarias.
- **Ampliar a más generaciones**: actualizar rangos y límites del índice en `controller.js`/`model.js` según el contenido real de API, además de revisar textos y documentación.

## 10. Referencias y atribución

- Documentación de PokéAPI: https://pokeapi.co/docs/v2
- Sitio de PokéAPI: https://pokeapi.co/
- Los nombres, datos e ilustraciones de Pokémon corresponden a sus respectivos titulares. Pokemora es un proyecto fan no oficial.

