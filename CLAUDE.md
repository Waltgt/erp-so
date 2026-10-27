# ERP – Práctica 3 (Arquitectura ERP + gestión de archivos multimedia)

Proyecto universitario individual. Infraestructura en 4 VMs de VirtualBox (Ubuntu Server 26.04.1 LTS)
sobre una red host-only. Este repositorio contiene el backend (NestJS + Prisma 7).

## Arquitectura

| VM           | IP            | Rol                                         |
|--------------|---------------|---------------------------------------------|
| server-web   | 192.168.56.10 | Nginx: sirve el build de Vue 3 y hace proxy a la API |
| server-app   | 192.168.56.11 | API NestJS (puerto 3000)                    |
| server-db    | 192.168.56.12 | PostgreSQL 18 (puerto 5432)                 |
| server-files | 192.168.56.13 | MinIO, API S3 (puerto 9000)                 |

- La PC de desarrollo (Windows, Git Bash) es 192.168.56.1.
- Firewall `ufw` en todas las VMs: deny incoming por defecto, solo los puertos de la tabla.

## Base de datos

- Base `erp_db`, esquema `erp` (no `public`).
- Dos roles, con mínimo privilegio:
  - `erp_owner`: dueño del esquema. SOLO para migraciones (variable `MIGRATION_DATABASE_URL`).
  - `erp_app`: solo SELECT/INSERT/UPDATE/DELETE. Lo usa la app en ejecución (`DATABASE_URL`).
- Base sombra `erp_shadow` para `prisma migrate dev` (`SHADOW_DATABASE_URL`).
- Prisma 7: la URL de la CLI está en `prisma.config.ts`; el runtime usa `@prisma/adapter-pg`
  con `{ schema: 'erp' }`. El cliente se genera en `src/generated/prisma` (no se versiona).

## Reglas obligatorias

1. Ejecuta todos los comandos (`npx prisma`, `npm`, `git`) desde la RAÍZ del repo, nunca desde `prisma/`.
2. Migraciones: SIEMPRE `npx prisma migrate dev --name <nombre> --create-only`, muestra el SQL
   generado y espera mi aprobación antes de aplicarlo.
3. NUNCA ejecutes `prisma migrate reset`, `prisma db push` ni nada que borre el esquema `erp`:
   se perderían los GRANT y ALTER DEFAULT PRIVILEGES de `erp_app`. Si Prisma propone un reset,
   detente y avísame.
4. Nunca modifiques una migración ya aplicada. Las correcciones van en una migración nueva.
5. Prisma no conoce las reglas que se agregaron con SQL manual (ver `docs/db/migration-extra.sql`):
   índice parcial `clientes_nit_unico`, índice `carpetas_nombre_unico` (NULLS NOT DISTINCT) y
   10 restricciones CHECK. Si una migración nueva intenta borrarlos (DROP INDEX / DROP CONSTRAINT),
   quita esas líneas y avísame.
6. Secretos: no leas, imprimas ni copies el contenido de `.env`. Usa `.env.example` como referencia.
   Nunca agregues `.env` ni `src/generated/` a git.
7. No ejecutes comandos por SSH en las VMs ni cambies su configuración (pg_hba.conf, ufw, netplan).
   Si hace falta un cambio en una VM, dame los comandos exactos para que yo los ejecute.
8. Antes de terminar una tarea, haz una recapitulación: qué cambió, cómo verificarlo y qué queda pendiente.
9. Las tareas de módulos (docs/modulos/) solo tocan código del repositorio.
    Cualquier cambio de infraestructura (Nginx, ufw, PostgreSQL, MinIO, PM2)
    se anota en docs/infra/pendientes.md en lugar de pedírmelo en ese momento.

## Decisiones de diseño (no cambiarlas sin preguntar)

- Dinero en `Decimal(12,2)`, nunca Float. `detalle_venta.precio_unitario` es una copia del precio al vender.
- Stock: descontar con un UPDATE atómico condicionado (`stock >= cantidad`) dentro de la transacción
  de la venta, verificando las filas afectadas. El CHECK `stock >= 0` es solo red de seguridad.
- Borrado lógico (`activo = false`) en usuarios, clientes, proveedores y productos. Las ventas se anulan, no se borran.
- Roles de la app: ADMIN, VENDEDOR, BODEGUERO, COMPRAS. No hay módulo de compras; COMPRAS gestiona proveedores.
- Archivos: cada usuario ve solo los suyos; ADMIN ve todos. En MinIO se guardan con un UUID
  (`object_key`), nunca con el nombre original. Validar en el servicio que la carpeta destino
  pertenezca al mismo usuario.
- Subida de archivos: stream directo a MinIO (no guardar en disco local). Orden: subir a MinIO,
  insertar la fila y, si el insert falla, borrar el objeto.
- Autenticación: JWT propio, contraseñas con bcrypt/argon2, guards por rol.
- El backend no guarda estado (preparado para PM2 en modo cluster más adelante).

## Entorno

- Windows + Git Bash (MINGW64). Usa sintaxis bash.
- Extras planificados para el final: SSL con mkcert, PM2 cluster, runner self-hosted de GitHub.