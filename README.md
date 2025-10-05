# Festival de Sitges 2025 - Agenda

Una agenda personalizada y compacta para el Festival de Sitges

Imágenes de iconos y colores de marca en https://brandfetch.com/sitgesfilmfestival.com 

 `index.html` usa Tailwind CSS y Vanilla JS. No es necesario ningún build step (no existe package.json).
 
Para que el PWA funcione, se necesita un servidor que use HTTPS (o `localhost`). 

Año 2025 - https://sitges-2025.netlify.app/


## Datos de las películas

Para el año 2025, las películas están en el archivo `2025/movies.json`. 

Para cada año nuevo:
1. Duplicar esta carpeta `2025/` y renombrarla a `2026/`
2. Actualizar `movies.json` con las nuevas películas del festival 2026
3. En `app.js` (raíz del proyecto), cambiar la línea:
   ```javascript
   const response = await fetch('./2025/movies.json');
   ```
   por:
   ```javascript
   const response = await fetch('./2026/movies.json');
   ```


### Estructura de cada película:

```json
{
  "id": "unique-id",
  "day": "Mar 14",
  "start": "13:30",
  "sala": "Auditori",
  "title": "Título de la película",
  "imdbScore": 7.0,
  "sitgesDuration": 95,
  "tag": "Presencia / Premio",
  "sitgesURL": "https://...",
  "imdbURL": "https://...",
  "posterURL": "https://...",
  "description": "Descripción completa...",
  "audience": "Nota personal opcional",
  "presences": ["Director", "Actor"],
  "awards": ["Premio específico"]
}
```

## Obtener los pósters de las películas

Para obtener automáticamente los pósters desde IMDb:

1. Asegúrate de tener las URLs de IMDb en el archivo `movies.json`
2. Edita `fetch-posters-node.js` y cambia el año si es necesario:
   ```javascript
   const YEAR = '2025'; // Cambiar a '2026' para el próximo año
   ```
3. Ejecuta el script desde la terminal:
   ```bash
   node fetch-posters-node.js
   ```

## Obtener pósters automáticamente

Si necesitas actualizar o añadir pósters a las películas:

1. Asegúrate de que cada película tenga su `imdbURL` correctamente configurado
2. Ve a la raíz del proyecto y edita `fetch-posters-node.js`:
   ```javascript
   const YEAR = '2025'; // Asegúrate de que apunta a este año
   ```
3. Ejecuta el script desde la terminal: `node fetch-posters-node.js`
4. El script actualizará automáticamente este archivo `movies.json` con los pósters encontrados.
   - Lee todas las películas del archivo `YEAR/movies.json`
   - Obtiene el póster de cada película desde IMDb
   - Actualiza automáticamente el archivo JSON con las URLs de los pósters
   - Muestra un resumen de los resultados en la consola

**Nota:** El script añade un pequeño delay entre peticiones para no sobrecargar IMDb.
