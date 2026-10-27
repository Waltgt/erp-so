# 05 – Ventas

El módulo más importante: aquí están las reglas de concurrencia y de dinero.

## Endpoints

| Método | Ruta                    | Roles           |
|--------|-------------------------|-----------------|
| POST   | /api/ventas             | ADMIN, VENDEDOR |
| GET    | /api/ventas             | ADMIN, VENDEDOR |
| GET    | /api/ventas/:id         | ADMIN, VENDEDOR |
| POST   | /api/ventas/:id/anular  | ADMIN           |

Listado con `?desde=&hasta=` (fechas), `?clienteId=`, `?estado=` y paginación.

## Crear venta

Body: `{ clienteId, items: [{ productoId, cantidad }] }`.

Validaciones previas (400):
- `items` con al menos 1 elemento y máximo 50.
- `cantidad` entero > 0.
- Sin `productoId` repetidos en `items` (rechazar, no sumar en silencio).
- El cliente existe y está activo.

Todo lo siguiente dentro de UNA transacción interactiva (`prisma.$transaction(async tx => ...)`):

1. Ordenar los items por `productoId` ascendente. Así dos ventas simultáneas bloquean las filas
   en el mismo orden y se evitan deadlocks.
2. Por cada item, descontar stock de forma atómica:
   `tx.producto.updateMany({ where: { id, activo: true, stock: { gte: cantidad } }, data: { stock: { decrement: cantidad } } })`.
   Si `count === 0`: lanzar 409 indicando el producto (sin stock suficiente o inactivo).
   La transacción completa se revierte: ningún stock queda descontado.
3. Leer `precioVenta` de cada producto DESDE LA BASE. El precio que mande el cliente, si lo
   manda, se ignora (el DTO no debe aceptarlo).
4. Calcular `subtotal = precio × cantidad` y `total = Σ subtotales` con `Prisma.Decimal`.
5. Crear la venta con sus detalles (`usuarioId` = usuario del token, nunca del body).

## Consultar

- VENDEDOR solo ve sus propias ventas. Si pide una venta ajena por id: 404 (no 403, para no
  revelar que existe).
- ADMIN ve todas.
- `GET /:id` incluye detalles con nombre y SKU del producto, cliente y vendedor.

## Anular

Body: `{ motivo: string 5–255 }`. En una transacción:
1. `updateMany({ where: { id, estado: 'COMPLETADA' }, data: { estado: 'ANULADA', anuladaEn: now, motivoAnulacion } })`.
   Si `count === 0`: 409 "La venta no existe o ya fue anulada". Esto evita que dos anulaciones
   simultáneas devuelvan el stock dos veces.
2. Devolver el stock de cada detalle con `increment`.

## Criterios de aceptación

- Venta correcta: 201, stock descontado, `total` igual a la suma de subtotales.
- Venta con un producto sin stock suficiente (de 3 items): 409 y NINGÚN stock cambia.
- Body con `precioUnitario` en un item: 400 (campo no permitido).
- Producto con stock 1 y dos ventas simultáneas de 1 unidad: una 201, otra 409; stock final 0.
  (Script para probarlo en paralelo.)
- Anular dos veces la misma venta: la segunda da 409 y el stock se devolvió una sola vez.
- VENDEDOR pidiendo venta de otro vendedor: 404.
- Prueba unitaria del cálculo de totales con decimales (ej. 3 × 19.99 = 59.97 exacto).
