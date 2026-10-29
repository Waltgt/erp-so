# 05 – Ventas

Backend: docs/modulos/05-ventas.md

## Pantallas

| Ruta             | Roles            |
|------------------|------------------|
| /ventas          | ADMIN, VENDEDOR  |
| /ventas/nueva    | ADMIN, VENDEDOR  |
| /ventas/:id      | ADMIN, VENDEDOR  |

## Nueva venta

1. Cliente: `AutoComplete` contra `/api/clientes?buscar=`, con un botón "Consumidor final"
   que busca y selecciona el primer cliente activo con NIT `CF`. Opción de crear un cliente
   rápido (reutiliza el diálogo de clientes).
2. Productos: `AutoComplete` por nombre o SKU (solo activos). Al elegir uno, se agrega una
   línea con cantidad 1. Si el producto ya está en la lista, sumar a su cantidad en vez de
   duplicar la línea (el backend rechaza productos repetidos).
3. Cada línea: SKU, nombre, precio unitario, stock disponible, cantidad (`InputNumber`
   entero de 1 al stock disponible) y subtotal. Botón para quitar la línea.
4. Total ESTIMADO: calcularlo en centavos enteros (precio × 100) para evitar errores de
   punto flotante, y mostrarlo con la etiqueta "Total estimado".
5. Confirmar: diálogo de resumen. Enviar solo `{ clienteId, items: [{ productoId, cantidad }] }`.
   Nunca enviar precios ni totales.
6. Respuesta 201: ir a `/ventas/:id` y mostrar el total que devolvió el backend (es el oficial).
7. Respuesta 409 (stock insuficiente): mostrar el mensaje, marcar la línea del producto
   afectado y recargar su stock disponible. No borrar el resto del formulario.
8. Botón confirmar deshabilitado mientras se envía (evita registrar la venta dos veces).
9. Máximo 50 líneas (límite del backend): al llegar, deshabilitar agregar productos.

## Listado

- Tabla: número, fecha, cliente, vendedor (solo ADMIN), total, estado (etiqueta verde
  COMPLETADA / roja ANULADA). Filtros: rango de fechas, cliente y estado.

## Detalle

- Encabezado: número, fecha, cliente (NIT y nombre), vendedor, estado.
- Tabla de detalles: SKU, producto, cantidad, precio unitario, subtotal; total al pie.
- Si está anulada: fecha y motivo de anulación.
- Botón "Anular" solo para ADMIN y solo si está COMPLETADA: diálogo con motivo obligatorio
  (5 a 255 caracteres) y confirmación. El 409 (ya anulada) muestra el mensaje y recarga.
- Botón "Imprimir": usa `window.print()` con una hoja de estilos de impresión que oculte el
  menú y los botones.

## Criterios de aceptación

- Agregar dos veces el mismo producto deja una sola línea con cantidad 2.
- 3 × Q19.99 muestra un total estimado de Q59.97 exacto.
- Con stock insuficiente en un producto, el formulario conserva las demás líneas y marca
  la que falló.
- Doble clic rápido en Confirmar registra una sola venta.
- Un VENDEDOR no ve la columna vendedor ni el botón Anular.
- La vista de impresión no muestra el menú.
