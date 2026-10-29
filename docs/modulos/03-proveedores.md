# 03 – Proveedores

## Endpoints

| Método | Ruta                  | Roles                       |
|--------|-----------------------|-----------------------------|
| GET    | /api/proveedores      | ADMIN, COMPRAS, BODEGUERO   |
| GET    | /api/proveedores/:id  | ADMIN, COMPRAS, BODEGUERO   |
| POST   | /api/proveedores      | ADMIN, COMPRAS              |
| PATCH  | /api/proveedores/:id  | ADMIN, COMPRAS              |
| DELETE | /api/proveedores/:id  | ADMIN, COMPRAS              |

Listado con `?buscar=` (nombre o NIT) y paginación.

## Reglas de negocio

- NIT: misma normalización que clientes. Aquí es único SIEMPRE (no existe "CF" para proveedores);
  rechazar `CF` con 400.
- `DELETE` es borrado lógico. Si el proveedor tiene productos activos, se permite desactivarlo,
  pero la respuesta incluye cuántos productos activos quedan asociados, para que el front avise.
- `GET /:id` incluye el conteo de productos activos del proveedor.
- `GET /` también lo incluye en cada fila (`productosActivos`), en la misma consulta: lo usa
  la tabla del frontend (docs/frontend/03-proveedores.md). Agregado el 2026-10-28.

## Criterios de aceptación

- NIT duplicado: 409.
- NIT `CF`: 400.
- BODEGUERO puede listar pero un POST suyo da 403.
- VENDEDOR en `/api/proveedores`: 403.
