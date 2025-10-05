# Datos del Festival de Sitges 2025

Este archivo contiene todas las películas del festival del año 2025.

El archivo contiene un array de objetos JSON, donde cada objeto representa una película con estos campos:

- `id`: Identificador único (string)
- `day`: Día del festival (ej. "Mar 14")
- `start`: Hora de inicio (ej. "13:30")
- `sala`: Nombre de la sala (ej. "Auditori")
- `title`: Título de la película (string)
- `imdbScore`: Puntuación IMDB (número o null)
- `sitgesDuration`: Duración en minutos (número)
- `tag`: Etiquetas especiales como "Presencia", "Premio" (string vacío si no hay)
- `sitgesURL`: URL de la película en el sitio de Sitges
- `imdbURL`: URL de la película en IMDB
- `posterURL`: URL del póster de la película
- `description`: Sinopsis de la película (string)
- `audience`: Notas personales (string, opcional)
- `presences`: Array de nombres de personas que asistirán (opcional)
- `awards`: Array de premios (opcional)


