# Festival de Sitges 2026 - Agenda

Una agenda personalizada y compacta para el Festival de Sitges, con las 14 sesiones
compradas para la edición de 2026.

Imágenes de iconos y colores de marca en https://brandfetch.com/sitgesfilmfestival.com

`index.html` usa Tailwind CSS y Vanilla JS. No es necesario ningún build step (no existe package.json).

Para que el PWA funcione, se necesita un servidor que use HTTPS (o `localhost`).

## Novedades respecto a la edición 2025

- Cada sesión incluye ahora `date` (fecha ISO), lo que permite calcular en tiempo real
  qué película toca **ahora** y cuál es la **siguiente**, con un banner fijo arriba y
  la tarjeta correspondiente resaltada. Se actualiza solo cada 30s mientras la app
  está abierta. Si una edición no tiene `date` (como 2025, que solo tenía `day`), la
  app simplemente no muestra "ahora/siguiente" para esa edición — no rompe nada.
- Al abrir la app, hace scroll automático a la sesión en curso o a la siguiente.
- Los pósters se sirven directamente desde Sitges (no hace falta el script de IMDb
  para esta edición) y el Service Worker los cachea para verlos sin conexión.
- Las tarjetas sin ficha en IMDb (títulos muy nuevos) ya no muestran un enlace roto.
- **Varias ediciones en la misma app**: selector al final de la página ("Ver otra
  edición") para cambiar entre años sin salir de la app — ver `AVAILABLE_YEARS` en
  `app.js`. Ya no hay filtro por día (no aportaba mucho con pocas sesiones).
- Si la app ya está instalada en la pantalla de inicio, el botón de instalar se
  oculta directamente en vez de mostrarse deshabilitado.
- Robustez offline: timeout de 4s si la red se queda colgada en vez de fallar rápido,
  respaldo en `localStorage` independiente del Service Worker (más fiable en iOS), y
  un panel de diagnóstico que solo aparece en pantalla si de verdad no hay datos que
  mostrar (nunca en el camino feliz).

## Datos de las sesiones

Las sesiones de cada edición están en su propia carpeta, p.ej. `2026/movies.json`.
Ver `2026/README.md` para el detalle de cada campo.

Para añadir una nueva edición futura:
1. Duplicar la carpeta `2026/` y renombrarla al año correspondiente.
2. Actualizar `movies.json` con las nuevas sesiones (incluyendo `date` en formato
   ISO, p.ej. `"2027-10-08"`, para tener el banner de ahora/siguiente).
3. Añadir el año a `AVAILABLE_YEARS` en `app.js` (al principio del archivo) y, si es
   la edición activa, poner ese año como primer elemento y actualizar la línea de
   `currentYear`.
4. Añadir la ruta `/AAAA/movies.json` a `urlsToCache` en `sw.js` para que se cachee
   offline desde la instalación.
5. Actualizar `manifest.json`, el `<title>` de `index.html` y `CACHE_NAME` en `sw.js`.

### Estructura de cada sesión:

```json
{
  "id": "unique-id",
  "day": "Vie 9",
  "date": "2026-10-09",
  "start": "13:30",
  "sala": "Sala Auditori Meliá",
  "title": "Título de la película",
  "imdbScore": 7.0,
  "sitgesDuration": 95,
  "tag": "Presencia",
  "sitgesURL": "https://...",
  "imdbURL": "https://... (o \"\" si no tiene ficha)",
  "posterURL": "https://...",
  "description": "Sinopsis completa...",
  "audience": "Nota / resumen en una frase",
  "presences": ["Equipo confirmado (Sitges)"],
  "awards": []
}
```

## Obtener los pósters de las películas (opcional)

Este año los pósters vienen directamente del propio Sitges. Si alguna vez hace
falta volver a tirar de IMDb (por ejemplo si Sitges retira una imagen):

1. Asegúrate de tener las URLs de IMDb en el archivo `movies.json`
2. Edita `fetch-posters-node.js` y cambia el año si es necesario:
   ```javascript
   const YEAR = '2026';
   ```
3. Ejecuta el script desde la terminal:
   ```bash
   node fetch-posters-node.js
   ```
   - Lee todas las películas de `YEAR/movies.json`
   - Obtiene el póster de cada película desde IMDb (vía `og:image`)
   - Actualiza automáticamente `movies.json` con las URLs encontradas

**Nota:** El script añade un pequeño delay entre peticiones para no sobrecargar IMDb.
