# 01 – Autenticación y usuarios

## Decisiones

- JWT propio (`@nestjs/jwt` + `passport-jwt`). Payload: `{ sub: id, rol }`.
- Hash de contraseñas: preferir `@node-rs/argon2` (binarios precompilados, sin compilar en
  Windows). Si da problemas de instalación, usar `bcryptjs`. Explícame cuál elegiste.
- En cada request autenticada, la estrategia JWT carga el usuario desde la base y rechaza
  (401) si no existe o si `activo = false`. Así, desactivar un usuario corta su acceso de
  inmediato, a cambio de una consulta por request (aceptable en este proyecto).
- Decoradores: `@Public()`, `@Roles(...roles)`, `@UsuarioActual()`.
  Guard JWT global; todo es privado salvo lo marcado como `@Public()`.

## Endpoints

| Método | Ruta                          | Roles      | Descripción                          |
|--------|-------------------------------|------------|--------------------------------------|
| POST   | /api/auth/login               | Público    | Devuelve `{ accessToken, usuario }`  |
| GET    | /api/auth/me                  | Todos      | Usuario actual                       |
| PATCH  | /api/auth/password            | Todos      | Cambiar la propia contraseña (pide la actual) |
| GET    | /api/usuarios                 | ADMIN      | Listado paginado                     |
| GET    | /api/usuarios/:id             | ADMIN      | Detalle                              |
| POST   | /api/usuarios                 | ADMIN      | Crear                                |
| PATCH  | /api/usuarios/:id             | ADMIN      | Editar nombre, rol, activo           |
| PATCH  | /api/usuarios/:id/password    | ADMIN      | Restablecer contraseña               |

## Reglas de negocio

- Email: `trim` + minúsculas antes de guardar y antes de buscar en el login.
- Contraseña: mínimo 10 caracteres.
- `passwordHash` NUNCA aparece en ninguna respuesta.
- Login con email inexistente y login con contraseña incorrecta responden el MISMO 401
  con el mismo mensaje (no revelar qué emails existen).
- Rate limit en login con `@nestjs/throttler`: 5 intentos por minuto por IP.
  Se complementa con Nginx en la fase 6 (ver `docs/infra/pendientes.md`).
- Un ADMIN no puede desactivarse ni quitarse el rol ADMIN a sí mismo.
- No se puede desactivar ni degradar al ÚLTIMO admin activo.

## Seed

- `prisma/seed.ts`, configurado en `prisma.config.ts` (`migrations.seed`).
- Crea un ADMIN con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env` SOLO si no existe ningún ADMIN.
  Es idempotente: ejecutarlo dos veces no duplica nada.

## Criterios de aceptación

- Login correcto devuelve token; con ese token, `/auth/me` responde 200.
- Sin token: 401. Con token de VENDEDOR en `/usuarios`: 403.
- Email inexistente y contraseña incorrecta: misma respuesta 401.
- El sexto intento de login en un minuto: 429.
- Desactivar un usuario: su token deja de funcionar en la siguiente request.
- Ninguna respuesta contiene `passwordHash`.
- Intentar desactivar al último admin: 409.
