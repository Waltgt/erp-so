# 04 – Productos e inventario

## Endpoints

| Método | Ruta                               | Roles                              |
|--------|------------------------------------|------------------------------------|
| GET    | /api/productos                     | Todos                              |
| GET    | /api/productos/:id                 | Todos                              |
| GET    | /api/productos/stock-bajo          | ADMIN, BODEGUERO, COMPRAS          |
| POST   | /api/productos                     | ADMIN, BODEGUERO                   |
| PATCH  | /api/productos/:id                 | ADMIN, BODEGUERO                   |
| DELETE | /api/productos/:id                 | ADMIN, BODEGUERO                   |
| POST   | /api/productos/:id/ajuste-stock    | ADMIN, BODEGUERO                   |

Listado con `?buscar=` (nombre o SKU), `?proveedorId=` y paginación.
OJO: declarar la ruta `stock-bajo` ANTES que `:id` en el controlador.

## Reglas de negocio

- SKU: `trim` + mayúsculas. Único (P2002 → 409).
- `stock` NO se puede modificar por `PATCH`: solo por ventas y por `ajuste-stock`.
  El DTO de PATCH no incluye `stock`.
- El VENDEDOR no ve el campo `costo` (es información interna). Implementarlo en el servicio
  según el rol, no en el front.
- `proveedorId`, si viene, debe ser un proveedor activo (400 si no).
- Agregado el 2026-10-28 para el frontend (docs/frontend/04-productos.md):
  - Toda respuesta de producto incluye `proveedor: { id, nombre, telefono } | null`, en la
    misma consulta (el VENDEDOR no puede leer `/api/proveedores`).
  - `stock-bajo` ordena por urgencia, `(stock_minimo - stock) DESC`, y cada fila trae
    `faltante` (= stockMinimo - stock). Como Prisma no ordena por expresiones, la página de
    ids sale de `$queryRaw` y los productos de `findMany`.
- Cambiar `precioVenta` no afecta ventas anteriores (el precio se copió en `detalle_venta`).

## Ajuste de stock

- Body: `{ cantidad: entero distinto de 0, motivo: string 5–255 }`. Positivo suma, negativo resta.
- Debe ser ATÓMICO, sin leer-y-luego-escribir:
  - Positivo: `update` con `increment`.
  - Negativo: `updateMany` con `where: { id, stock: { gte: -cantidad } }` y `decrement`;
    si `count === 0`, responder 409 "Stock insuficiente".
- Limitación conocida (documentada en el informe): el `motivo` no se guarda porque no hay tabla
  de ajustes; solo se escribe en el log de la aplicación con el usuario que lo hizo.

## Stock bajo

- Productos activos con `stock <= stockMinimo`. Comparar dos columnas: usar referencias de
  campo de Prisma (`prisma.producto.fields.stockMinimo`); si no funcionan en esta versión,
  `$queryRaw` con parámetros (nunca concatenar strings en SQL).

## Criterios de aceptación

- Respuesta de producto con token de VENDEDOR: sin `costo`. Con token de ADMIN: con `costo`.
- PATCH con `stock` en el body: 400 (campo no permitido).
- Ajuste de -10 con stock 5: 409, y el stock sigue en 5.
- Dos ajustes de -5 lanzados al mismo tiempo con stock 5: uno 200, el otro 409; stock final 0.
  (Dame un script o comando para probarlo en paralelo.)
- `stock-bajo` lista un producto con stock 2 y mínimo 5.
