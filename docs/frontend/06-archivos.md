# 06 – Archivos multimedia

Backend: docs/modulos/06-archivos.md (con la decisión de URL firmada).

## Pantalla `/archivos` (todos los roles; cada uno ve lo suyo, ADMIN ve todo)

Explorador de archivos con:

- Ruta de navegación (`Breadcrumb`): Inicio > carpeta > subcarpeta. Clic para subir de nivel.
  La carpeta actual se refleja en la URL (`/archivos?carpeta=12`) para poder recargar o
  compartir el enlace interno.
- Lista del nivel actual: primero carpetas, luego archivos. Columnas: icono por tipo,
  nombre, tipo, tamaño legible (KB/MB), duración (mm:ss, si existe), fecha.
  ADMIN ve además la columna "Dueño" y un filtro por usuario.
- Filtros: tipo (música, documento, imagen, video, otro) y búsqueda por nombre.

## Acciones

- Nueva carpeta, renombrar y mover (diálogo con selector de carpeta destino). Al mover una
  carpeta, no ofrecer como destino ella misma ni sus descendientes; si el backend igual
  responde 400, mostrar su mensaje.
- Borrar con confirmación. Carpeta con contenido: mostrar el 409 del backend.
- Subir: `FileUpload` de PrimeVue en modo personalizado, con arrastrar y soltar.
  - `accept` con la lista blanca de tipos del backend.
  - Validar el tamaño antes de enviar (el límite lo informa el backend o una constante
    documentada igual a `ARCHIVO_TAMANO_MAX_MB`).
  - Barra de progreso por archivo (`onUploadProgress` de axios). Subir de a uno para no
    saturar la conexión. Mostrar 413/415 por archivo sin cancelar los demás.

## Reproducir y descargar (URL firmada)

- Para reproducir o descargar, pedir al backend la URL firmada del archivo (ver la
  especificación del backend). Nunca construir URLs de Garage en el front.
- Música: reproductor fijo al pie de la pantalla con `<audio controls>` cuyo `src` es la
  URL firmada. Mostrar título y duración.
- Video: diálogo con `<video controls>`. Imagen: vista previa en diálogo. PDF: abrir la URL
  en una pestaña nueva.
- Descargar: enlace `<a>` con la URL firmada en modo descarga. No usar `fetch` para bajar
  el archivo (evita tener que configurar CORS en Garage).
- Vencimiento: si el elemento `<audio>`/`<video>` dispara `error` (la URL venció mientras se
  escuchaba, por ejemplo al adelantar después de varios minutos), pedir una URL nueva y
  continuar desde `currentTime` de forma transparente. Un solo reintento automático; si
  falla de nuevo, mostrar el error.
- Nunca guardar las URLs firmadas en localStorage ni mostrarlas en la interfaz.

## Criterios de aceptación

- Subir un mp3: aparece en la carpeta actual con su duración (si el backend la calcula).
- Reproducir y adelantar la canción funciona.
- Esperar a que venza la URL y adelantar: la reproducción continúa tras un breve corte.
- Un usuario no ve los archivos de otro; ADMIN sí, con la columna Dueño.
- Subir un .exe muestra el 415 sin afectar otros archivos de la misma tanda.
- Recargar la página dentro de una subcarpeta mantiene la carpeta.
