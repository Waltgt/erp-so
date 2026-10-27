# 06 – Carpetas y archivos multimedia

REQUISITO: Fase 4 terminada (MinIO u otro servicio compatible con S3 en server-files, con
bucket y credenciales). No empezar este módulo antes.

## Decisiones

- Cliente S3: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` (no el SDK propio de MinIO).
  Así el backend no depende de MinIO en particular.
- Variables nuevas: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
  `ARCHIVO_TAMANO_MAX_MB`. Con `forcePathStyle: true`.
- Subida en STREAM directo a S3 (motor de almacenamiento propio de multer o busboy). No usar
  `memoryStorage` ni `diskStorage`: cargarían el archivo completo en RAM o en el disco de server-app.
- PENDIENTE DE DECIDIR en la Fase 4: descarga por URL firmada o por proxy en el backend.
  Preguntar antes de implementar `GET /archivos/:id/descarga`.

## Endpoints: carpetas (todos los roles, siempre sobre las propias)

| Método | Ruta                  | Descripción                                   |
|--------|-----------------------|-----------------------------------------------|
| GET    | /api/carpetas         | `?parentId=` (vacío = raíz); carpetas y archivos de ese nivel |
| POST   | /api/carpetas         | `{ nombre, parentId? }`                       |
| PATCH  | /api/carpetas/:id     | Renombrar o mover (`parentId`)                |
| DELETE | /api/carpetas/:id     | Solo si está vacía                            |

## Endpoints: archivos

| Método | Ruta                         | Descripción                              |
|--------|------------------------------|------------------------------------------|
| POST   | /api/archivos                | multipart: `archivo` + `carpetaId?`      |
| GET    | /api/archivos                | `?tipo=&carpetaId=&buscar=` paginado      |
| GET    | /api/archivos/:id            | Metadatos                                |
| GET    | /api/archivos/:id/descarga   | Ver decisión pendiente                   |
| PATCH  | /api/archivos/:id            | Renombrar (`nombreOriginal`) o mover     |
| DELETE | /api/archivos/:id            | Borra en S3 y en la base                 |

## Reglas de negocio

- Propiedad: cada usuario solo ve y modifica lo suyo. ADMIN ve todo. Recurso ajeno: 404.
- Al crear o mover, `parentId`/`carpetaId` debe pertenecer al MISMO usuario (400 si no).
- Mover una carpeta: rechazar si el destino es ella misma o una de sus descendientes (ciclo).
- `object_key` = `randomUUID()`. El nombre original solo se guarda como metadato y se limpia
  (sin rutas, sin caracteres de control, máximo 255).
- Tipos permitidos (lista blanca) por MIME: audio (mp3, ogg, wav, flac, m4a), documentos (pdf,
  docx, xlsx, txt), imágenes (png, jpg, webp), video (mp4, webm). `tipo` se deduce del MIME.
  Explica si el MIME se valida solo por la cabecera o también por los primeros bytes del archivo.
- Tamaño máximo: `ARCHIVO_TAMANO_MAX_MB`. Al superarlo: 413, y no debe quedar nada en S3.
- Consistencia entre S3 y la base (no son atómicos juntos):
  - Subir: primero S3, después insertar la fila; si el insert falla, borrar el objeto de S3.
  - Borrar: primero la fila, después S3; si S3 falla, registrar en el log el `object_key`
    huérfano (no revertir la fila).
- Duración (música/video): opcional. Si se implementa, calcularla en el servidor (por ejemplo
  con `music-metadata`), nunca aceptarla del cliente.

## Criterios de aceptación

- Subir un mp3: 201; aparece en MinIO con nombre UUID y en la tabla con el nombre original.
- Subir un .exe: 415.
- Subir un archivo mayor al límite: 413 y el bucket queda igual.
- Usuario A pide el archivo de usuario B: 404. ADMIN sí lo ve.
- Borrar carpeta con contenido: 409.
- Mover una carpeta dentro de su propia hija: 400.
- Durante una subida grande, la RAM de server-app no crece en proporción al tamaño del archivo.
