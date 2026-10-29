# 04 – Productos e inventario

Backend: docs/modulos/04-productos.md

## Pantallas

| Ruta                     | Roles                          |
|--------------------------|--------------------------------|
| /productos               | Todos (escriben ADMIN, BODEGUERO) |
| /productos/stock-bajo    | ADMIN, BODEGUERO, COMPRAS      |

## Listado

- Tabla: SKU, nombre, proveedor, precio de venta, costo, stock, stock mínimo, estado.
  - La columna "costo" se muestra solo si la respuesta trae el campo. El backend no lo
    envía al VENDEDOR; el front no debe asumir que existe.
  - Resaltar en rojo el stock cuando `stock <= stockMinimo`.
- Filtros: búsqueda (nombre o SKU) y proveedor (desplegable con búsqueda).

## Crear / editar (ADMIN, BODEGUERO)

- Campos: SKU, nombre, descripción, precio de venta, costo, stock mínimo, proveedor.
- El stock NO aparece en este formulario (el backend no lo acepta por PATCH).
  Al crear, el producto empieza con stock 0.
- Precios: `InputNumber` en modo moneda GTQ, máximo 2 decimales, sin negativos.
- Aviso al editar el precio: "El cambio no afecta ventas ya registradas".

## Ajuste de stock (ADMIN, BODEGUERO)

- Botón por fila que abre un diálogo: tipo (Entrada / Salida), cantidad (entero > 0) y
  motivo (5 a 255 caracteres). El front convierte "Salida" en cantidad negativa.
- Mostrar el stock actual y el resultante antes de confirmar.
- 409 "Stock insuficiente": mostrar el mensaje y recargar la fila (otro usuario pudo haber
  cambiado el stock).

## Stock bajo

- Tabla de solo lectura con la diferencia `stockMinimo - stock`, ordenada de mayor a menor
  urgencia, y el proveedor con su teléfono para facilitar el pedido.

## Criterios de aceptación

- Con VENDEDOR no aparece la columna de costo ni los botones de edición.
- Un ajuste de salida mayor al stock muestra el 409 y la tabla queda con el valor real.
- Un producto con stock 2 y mínimo 5 aparece en rojo y en /productos/stock-bajo.
