# 02 – Clientes

Backend: docs/modulos/02-clientes.md

## Pantalla `/clientes` (ADMIN, VENDEDOR)

- Tabla: NIT, nombre, teléfono, email, estado. Búsqueda única (nombre o NIT) y paginación
  del servidor. Interruptor "Mostrar inactivos" solo para ADMIN.
- Diálogo de crear/editar: NIT, nombre, email, teléfono, dirección.
  - Botón "Consumidor final" que llena el NIT con `CF`.
  - Mostrar el NIT tal como se guardará (sin guiones ni espacios, en mayúsculas) debajo
    del campo, para que el usuario vea la normalización.
- Desactivar: solo ADMIN, con confirmación.
- Detalle `/clientes/:id`: datos del cliente y sus últimas ventas (usa
  `GET /api/ventas?clienteId=`). Un VENDEDOR ve solo las ventas suyas, porque así lo filtra
  el backend; no hacer nada especial en el front.

## Criterios de aceptación

- Buscar "perez" encuentra a "Juan Pérez" (lo resuelve el backend con unaccent).
- Crear un cliente con un NIT ya registrado muestra el 409 junto al campo NIT.
- Dos clientes con NIT `CF` se pueden crear sin error.
- El VENDEDOR no ve el botón de desactivar.
