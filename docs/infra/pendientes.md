# Pendientes de infraestructura

Cambios en las VMs que se detectaron durante el desarrollo del backend. Se aplican en
la fase indicada; mientras tanto, el backend funciona sin ellos.

---

## 1. Rate limit del login en Nginx (fase 6, server-web)

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
