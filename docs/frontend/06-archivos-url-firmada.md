# Cambio al módulo 06 del backend: descarga por URL firmada

Decisión tomada: los archivos se reproducen y descargan con URLs firmadas que apuntan a
Garage a través de Nginx (server-web). La subida sigue pasando por el backend (stream).
Este documento reemplaza la sección "PENDIENTE DE DECIDIR" de docs/modulos/06-archivos.md.

## Por qué Nginx y no Garage directo

- El navegador no puede llegar a server-files (ufw solo permite a server-app), y así debe
  seguir: un único punto de entrada.
- Nginx escuchará en un puerto dedicado (3900) en server-web y reenviará a Garage
  conservando el encabezado Host EXACTO. Una URL firmada incluye el host y la ruta en la
  firma; si el proxy cambia cualquiera de los dos, Garage responde "Invalid signature".
  Por eso NO se usa un prefijo de ruta (/s3/...), sino un puerto propio sin reescritura.

## Variables nuevas

- `S3_PUBLIC_ENDPOINT`: la dirección que usa el NAVEGADOR (producción:
  `http://192.168.56.10:3900`).
- `URL_FIRMADA_SEGUNDOS`: vigencia de la URL (por defecto 900).

## Diseño

- Dos clientes S3 en el backend:
  - Interno (`S3_ENDPOINT`, server-files): subir, borrar, leer metadatos.
  - Firmador (`S3_PUBLIC_ENDPOINT`): solo para generar URLs firmadas. Firmar no hace
    peticiones de red; solo calcula la firma con el host público.
- Endpoint nuevo: `GET /api/archivos/:id/url?modo=ver|descargar`
  - Verifica propiedad (ajeno → 404; ADMIN puede todo).
  - Devuelve `{ url, expiraEn }`.
  - `modo=descargar`: firmar con `ResponseContentDisposition` =
    `attachment; filename*=UTF-8''<nombre original codificado>`.
  - `modo=ver`: `inline`, y `ResponseContentType` = mime guardado.
  - Comprobar en la prueba que Garage respeta estos encabezados de respuesta; si no lo
    hace, avisar antes de buscar otra solución.
- Eliminar el endpoint `GET /api/archivos/:id/descarga` de la especificación original.
- Registrar en el log cada URL emitida (usuario, archivo, modo), sin la URL completa.

## Desarrollo en la PC

Mientras no exista Nginx, `S3_PUBLIC_ENDPOINT=http://192.168.56.13:3900` (la regla TEMP de
ufw en server-files ya permite a la PC). En producción cambia a server-web.

## Criterios de aceptación

- `GET /api/archivos/:id/url?modo=ver` de un mp3 devuelve una URL que reproduce en el
  navegador y permite adelantar (Garage responde 206 a peticiones con Range).
- La misma URL después de `URL_FIRMADA_SEGUNDOS`: 403.
- Pedir la URL de un archivo ajeno: 404.
- `modo=descargar` baja el archivo con su nombre original (incluyendo tildes).

## Infraestructura (anotar en docs/infra/pendientes.md, fase 6)

En server-web, un `server` adicional de Nginx:

```nginx
server {
    listen 3900;
    client_max_body_size 0;
    location / {
        proxy_pass http://192.168.56.13:3900;
        proxy_set_header Host $http_host;      # host:puerto tal cual lo firmó el backend
        proxy_buffering off;                   # streaming de audio/video
        proxy_request_buffering off;
    }
}
```

- ufw en server-web: permitir 3900/tcp.
- ufw en server-files: permitir 3900 desde 192.168.56.10 (además de server-app).
- Con SSL (extra), este server también pasa a https y `S3_PUBLIC_ENDPOINT` cambia a https.
