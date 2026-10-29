# Pendientes de infraestructura

Cambios en las VMs que se detectaron durante el desarrollo del backend. Se aplican en
la fase indicada; mientras tanto, el backend funciona sin ellos.

---

## 1. Rate limit del login en Nginx (fase 6, server-web)

**Estado: APLICADO (2026-10-28).** Nginx instalado y configurado en server-web (fase 6).

**Origen:** módulo 01 (auth). Criterio: "el sexto intento de login en un minuto: 429".

**Estado actual:** la app ya lo cumple con `@nestjs/throttler` (5 intentos por minuto por
IP, solo en `POST /api/auth/login`; ver `src/modules/auth/auth.module.ts`).

**Por qué hace falta también en Nginx:** el throttler guarda los contadores en la memoria
de cada proceso. Con PM2 en modo cluster cada worker tiene sus propios contadores y no los
comparte, así que con N workers el límite real sería 5 × N intentos por minuto. Nginx es un
único punto de entrada y cuenta para todos los workers. Se dejan las dos capas: Nginx como
límite real en producción y el throttler para desarrollo (sin Nginx) y como respaldo.

**Configuración:**

1. Zona de límite, en el contexto `http` (los archivos de `conf.d/` se incluyen ahí):

   ```bash
   sudo tee /etc/nginx/conf.d/rate-limit.conf > /dev/null <<'EOF'
   # 5 intentos de login por minuto por IP (1 cada 12 s), compartido por todos los workers
   limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
   # Sin esto, Nginx responde 503 al superar el límite
   limit_req_status 429;
   EOF
   ```

2. Dentro del `server { }` del sitio, **antes** del `location /api/` general (la
   coincidencia exacta `=` tiene prioridad):

   ```nginx
   location = /api/auth/login {
       # burst=4 + nodelay: 5 intentos seguidos pasan sin espera, el 6º recibe 429
       limit_req zone=login burst=4 nodelay;

       proxy_pass http://192.168.56.11:3000;   # el mismo destino que location /api/
       proxy_set_header Host              $host;
       proxy_set_header X-Real-IP         $remote_addr;
       proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

3. Validar y recargar:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

**Notas:**

- `rate=5r/m` repone 1 intento cada 12 s (no es una ventana fija de 1 minuto). Con
  `burst=4 nodelay` se permiten 5 intentos inmediatos y el 6º recibe 429, que es lo que
  pide el criterio.
- Con Nginx delante, la app sigue aplicando su propio límite por proceso. El cliente verá
  el 429 de Nginx o el de la app (`"Demasiados intentos de inicio de sesión..."`), lo que
  ocurra primero.

**Verificación (desde la PC de desarrollo):**

```bash
for i in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "intento $i -> %{http_code}\n" -X POST http://192.168.56.10/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"nadie@empresa.com","password":"x"}'
done
# intentos 1-5 -> 401, 6 y 7 -> 429
```

---

## 2. Nginx debe reenviar la IP real del cliente (fase 6, server-web)

**Estado: APLICADO (2026-10-28)**, con una diferencia: ver la sección 6.

**Origen:** módulo 01 (throttler) y `app.set('trust proxy', 1)` en `src/configurar-app.ts`.

**Por qué:** detrás de Nginx, la app ve todas las conexiones como si vinieran de
192.168.56.10. Con `trust proxy` toma la IP real de `X-Forwarded-For`, pero solo si Nginx
envía esa cabecera. Sin ella, **todos los usuarios compartirían el mismo contador** del
throttler: 5 intentos fallidos de cualquiera bloquearían el login de todos.

**Configuración:** en **todos** los `location` que hagan `proxy_pass` a la API (no solo el
del login), incluir:

```nginx
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

`trust proxy` está en `1` (un solo proxy). Si en el futuro hay otro proxy delante de Nginx,
hay que ajustar ese valor.

**Verificación:** con Nginx funcionando, 5 logins fallidos desde una PC no deben bloquear
el login desde otra.

---

## 3. (Opcional) Búsqueda que ignore tildes: extensión `unaccent` (server-db)

**Origen:** módulo 02 (clientes), criterio "`?buscar=perez` encuentra a Juan Pérez".

**Estado actual:** la búsqueda usa `ILIKE` (Prisma `mode: 'insensitive'`): no distingue
mayúsculas, pero **no ignora tildes** (`perez` no encuentra "Pérez"). La especificación lo
acepta si se documenta; no hace falta para cumplir el módulo.

**Si se quiere:** `unaccent` es una extensión *trusted* desde PostgreSQL 13: la puede crear
cualquier rol con permiso `CREATE` sobre la base `erp_db`. Si `erp_owner` no lo tiene, la
crea un superusuario (no hace falta darle más permisos a `erp_owner`):

```bash
sudo -u postgres psql -d erp_db -c 'CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA erp;'
```

Después hay que cambiar el backend: la búsqueda de clientes pasaría a SQL crudo con
`unaccent(nombre) ILIKE unaccent($1)`, porque Prisma no soporta `unaccent` en `where`. Para
que use índice haría falta además un índice de expresión (con una función `IMMUTABLE`
que envuelva a `unaccent`), lo que implica una migración nueva.

---

## 4. Fase 4 con Garage en lugar de MinIO (server-files)

**Estado: APLICADO (2026-10-28).** Verificado desde la PC: HeadBucket, Put/Head/Get/Delete
de un objeto y ListObjectsV2 funcionan; `CreateBucket` con la clave de la app da 403.

**Origen:** módulo 06 (archivos). MinIO ya no está disponible para descargar; se usa
[Garage](https://garagehq.deuxfleurs.fr/), que también habla la API S3. El backend no
cambia de diseño: usa `@aws-sdk/client-s3` con `forcePathStyle: true`.

**Diferencias con lo planeado para MinIO:**

| Cosa              | MinIO (antes)  | Garage (ahora)                                  |
|-------------------|----------------|-------------------------------------------------|
| Puerto API S3     | 9000           | **3900** (3901 = RPC entre nodos, 3903 = admin) |
| Región            | `us-east-1`    | **`garage`** (la de `s3_region` en garage.toml) |
| Consola web       | sí             | no (se administra con el comando `garage`)      |
| Claves de acceso  | usuario/clave  | `garage key create` → ID que empieza con `GK`   |

**Instalación (nodo único, en server-files).** Revisar la última versión estable en
<https://garagehq.deuxfleurs.fr/download/> y ajustar `VERSION`:

```bash
VERSION=v2.1.0
sudo curl -fL -o /usr/local/bin/garage \
  "https://garagehq.deuxfleurs.fr/_releases/${VERSION}/x86_64-unknown-linux-musl/garage"
sudo chmod +x /usr/local/bin/garage
garage --version

# Configuración. Con un solo nodo: replication_factor = 1.
sudo tee /etc/garage.toml > /dev/null <<EOF
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "lmdb"

replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "$(openssl rand -hex 32)"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[admin]
api_bind_addr = "127.0.0.1:3903"
admin_token = "$(openssl rand -base64 32)"
EOF
# Lo lee el usuario dinámico del servicio
sudo chmod 644 /etc/garage.toml

# Servicio systemd (unidad recomendada por la documentación de Garage)
sudo tee /etc/systemd/system/garage.service > /dev/null <<'EOF'
[Unit]
Description=Garage Data Store
After=network-online.target
Wants=network-online.target

[Service]
Environment='RUST_LOG=garage=info' 'RUST_BACKTRACE=1'
ExecStart=/usr/local/bin/garage server
StateDirectory=garage
DynamicUser=true
ProtectHome=true
NoNewPrivileges=true
LimitNOFILE=42000

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now garage
sudo systemctl status garage --no-pager
```

**Distribución (layout), bucket y clave de la app:**

```bash
sudo garage status                       # copia el ID del nodo (primera columna)
sudo garage layout assign -z dc1 -c 20G <ID_DEL_NODO>
sudo garage layout apply --version 1

sudo garage bucket create erp-archivos
sudo garage key create erp-app           # muestra Key ID (GK...) y Secret key: anótalos
sudo garage bucket allow --read --write erp-archivos --key erp-app
sudo garage bucket info erp-archivos
```

La clave `erp-app` solo tiene permiso sobre `erp-archivos` (mínimo privilegio, igual que
`erp_app` en PostgreSQL). Key ID y Secret key van en el `.env` de la app como
`S3_ACCESS_KEY` y `S3_SECRET_KEY` (ver `.env.example`).

**Firewall:** solo la API S3 (3900), desde server-app y desde la PC de desarrollo
(mientras se usa `npm run start:dev` en Windows). 3901 y 3903 quedan cerrados.

```bash
sudo ufw allow from 192.168.56.11 to any port 3900 proto tcp comment 'Garage S3 desde server-app'
sudo ufw allow from 192.168.56.1  to any port 3900 proto tcp comment 'Garage S3 desde PC de desarrollo'
# Si se había abierto el 9000 para MinIO, quitarlo:
sudo ufw status numbered                 # y luego: sudo ufw delete <número>
```

**Verificación (desde la PC de desarrollo):**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.56.13:3900/
# 403 (petición sin firmar) = Garage responde. Timeout = ufw o servicio caído.
```

**Notas:**

- `rpc_secret` y `admin_token` quedan en `/etc/garage.toml` legible por todos los usuarios
  locales de server-files. Aceptable en esta VM de desarrollo; en producción se usarían
  `rpc_secret_file` / `admin_token_file` con permisos 600.
- Las versiones recientes del SDK de AWS envían checksums CRC32 por defecto. Garage los
  soporta desde la v1.1, pero el backend los configura en "solo cuando se requieran"
  (`requestChecksumCalculation: 'WHEN_REQUIRED'`) para no depender de eso.

---

## 5. Subidas grandes a través de Nginx (fase 6, server-web)

**Estado: APLICADO (2026-10-28)**, con diferencias: ver la sección 6.

**Origen:** módulo 06. La API recibe el archivo en stream y lo manda directo a Garage, sin
guardarlo en disco ni en RAM. Nginx, por defecto, hace dos cosas que lo impiden:

- `client_max_body_size` es **1 MB**: cualquier archivo mayor recibe 413 de Nginx.
- `proxy_request_buffering on`: Nginx guarda el cuerpo completo (en disco de server-web)
  antes de pasarlo a la API.

**Configuración:** dentro del `server { }`, un `location` para las subidas, antes del
`location /api/` general:

```nginx
location = /api/archivos {
    # Un poco más que ARCHIVO_TAMANO_MAX_MB (el multipart agrega cabeceras);
    # el límite exacto lo aplica la API (413)
    client_max_body_size 110m;
    # Pasar el cuerpo a la API a medida que llega
    proxy_request_buffering off;
    proxy_http_version 1.1;

    proxy_pass http://192.168.56.11:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Si se cambia `ARCHIVO_TAMANO_MAX_MB`, ajustar también `client_max_body_size`.

---

## 6. Nginx en server-web: lo que quedó aplicado (fase 6)

**Estado: APLICADO (2026-10-28).** Configurado por el usuario en server-web. Incluye los
puntos 1, 2 y 5 y el `server` del puerto 3900 hacia Garage (para las URLs firmadas, ver
`docs/frontend/06-archivos-url-firmada.md`).

**Diferencias respecto a lo que decía este documento:**

- **X-Forwarded-For** se fija con `$remote_addr` (reemplaza el valor que mande el cliente)
  en vez de `$proxy_add_x_forwarded_for`. Con `trust proxy = 1` la app toma la IP real
  igual, y además un cliente no puede inyectar una IP falsa en la cabecera.
- **client_max_body_size = ARCHIVO_TAMANO_MAX_MB + 10** (hoy `60m`, no `110m`). Si cambia
  el límite de la API, cambiar los dos.
- La ruta de subida (`location = /api/archivos`) tiene **`proxy_read_timeout 300s`**.
- El puerto **3900 solo acepta GET y HEAD** (`limit_except`): desde el navegador no se
  puede subir ni borrar en Garage, aunque se tuviera una URL firmada para eso.
- **CSP enviada por Nginx:** incluye `http://192.168.56.10:3900` en `img-src` y
  `media-src` (para `<img>`, `<audio>` y `<video>` con URL firmada). `style-src` lleva
  `'unsafe-inline'` por PrimeVue: revisar si se puede quitar cuando exista el frontend.

---

## 7. Variables del `.env` de server-app al desplegar el backend

**Estado: PENDIENTE.** Agregarlas al `.env` de server-app cuando se despliegue:

- `TRUST_PROXY`: número de proxies delante de la app (hoy 1: Nginx).
- `S3_PUBLIC_ENDPOINT`: `http://192.168.56.10:3900` (Nginx en server-web), la dirección
  con la que se firman las URLs que usa el navegador.

El backend ya las lee (2026-10-28, ver `.env.example`). `S3_PUBLIC_ENDPOINT` es
**obligatoria**: sin ella la app no arranca. `TRUST_PROXY` (por defecto 1) y
`URL_FIRMADA_SEGUNDOS` (por defecto 900) son opcionales. En la PC de desarrollo,
`S3_PUBLIC_ENDPOINT` también es `http://192.168.56.10:3900`, porque el navegador pasa por
Nginx.

---

## 8. (Recomendado) `nosniff` en el server de Nginx del puerto 3900 (server-web)

**Origen:** módulo 06 (URLs firmadas). Garage no envía `X-Content-Type-Options`. Con
`modo=ver` el archivo se sirve `inline`; sin `nosniff`, un navegador podría "adivinar"
otro tipo distinto al MIME guardado (por ejemplo, tratar como HTML un .txt subido con
contenido HTML). Dentro del `server { listen 3900; ... }`:

```nginx
add_header X-Content-Type-Options nosniff always;
```

Después: `sudo nginx -t && sudo systemctl reload nginx`.
