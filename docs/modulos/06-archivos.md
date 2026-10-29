# 06 – Carpetas y archivos multimedia

REQUISITO: Fase 4 terminada (MinIO u otro servicio compatible con S3 en server-files, con
bucket y credenciales). No empezar este módulo antes.

ACTUALIZACIÓN: se usa **Garage** (compatible con S3) en lugar de MinIO, que ya no está
disponible para descargar. Puerto 3900, región `garage`. Instalación en
`docs/infra/pendientes.md` (sección 4). Fase 4 terminada el 2026-10-28: Garage instalado,
bucket `erp-archivos` y clave `erp-app` (lectura/escritura, sin permiso de dueño) verificados
desde la PC de desarrollo.

## Decisiones

- Cliente S3: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` (no el SDK propio de MinIO).
  Así el backend no depende de MinIO en particular.
- Variables nuevas: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
  `ARCHIVO_TAMANO_MAX_MB`. Con `forcePathStyle: true`.
- Subida en STREAM directo a S3 (motor de almacenamiento propio de multer o busboy). No usar
  `memoryStorage` ni `diskStorage`: cargarían el archivo completo en RAM o en el disco de server-app.
- Descarga (DECIDIDO, 2026-10-28; reemplaza a la descarga por proxy): por **URL firmada**
  (detalle en `docs/frontend/06-archivos-url-firmada.md`). La API verifica el permiso y
  firma una URL de Garage con el host de Nginx (`S3_PUBLIC_ENDPOINT`, server-web:3900);
  el navegador la pide directamente y el contenido no pasa por server-app. Vigencia:
  `URL_FIRMADA_SEGUNDOS` (900 por defecto). La subida sigue pasando por el backend.
- MIME (DECIDIDO): se valida solo por la cabecera `Content-Type` de la parte del multipart,
  no por los primeros bytes del archivo.
- Duración (DECIDIDO): no se implementa por ahora; `duracion_seg` queda en null.
- ADMIN y archivos ajenos (DECIDIDO): ADMIN puede ver, descargar, renombrar, mover y borrar
  cualquier archivo. Al mover un archivo ajeno, la carpeta destino debe ser del DUEÑO del archivo.
  Al subir, el archivo siempre es del usuario del token. Las carpetas son siempre propias (también
  para ADMIN).
- S3_REGION debe ser "garage" (igual que s3_region en el servidor).
- forcePathStyle: true.
- La llave del backend tiene permisos de lectura y escritura sobre el bucket, pero NO de dueño: el backend no debe intentar crear buckets ni cambiar su configuración.
- Garage no implementa ACL ni políticas de bucket; la autorización es 100 % responsabilidad del backend.

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
| GET    | /api/archivos                | `?tipo=&carpetaId=&buscar=&usuarioId=` paginado (ver nota) |
| GET    | /api/archivos/:id            | Metadatos                                |
| GET    | /api/archivos/:id/url        | `?modo=ver|descargar` → `{ url, expiraEn }` |
| PATCH  | /api/archivos/:id            | Renombrar (`nombreOriginal`) o mover     |
| DELETE | /api/archivos/:id            | Borra en S3 y en la base                 |

Nota (agregado el 2026-10-28 para el frontend, docs/frontend/06-archivos.md): en
`GET /api/archivos` cada archivo trae `usuario: { id, nombre }` (dueño) y
`carpeta: { id, nombre } | null`, en la misma consulta. `?usuarioId=` es solo para ADMIN
(otro rol: 403). Las carpetas siguen siendo siempre propias, así que el ADMIN ve los
archivos de los demás en esta lista, no recorriendo sus carpetas.

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

- Subir un mp3: 201; aparece en el bucket con nombre UUID y en la tabla con el nombre original.
- Subir un .exe: 415.
- Subir un archivo mayor al límite: 413 y el bucket queda igual.
- Usuario A pide el archivo de usuario B: 404. ADMIN sí lo ve.
- Borrar carpeta con contenido: 409.
- Mover una carpeta dentro de su propia hija: 400.
- Durante una subida grande, la RAM de server-app no crece en proporción al tamaño del archivo.
