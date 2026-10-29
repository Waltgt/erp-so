# 02 – Clientes

Backend: docs/modulos/02-clientes.md

## Pantalla `/clientes` (ADMIN, VENDEDOR)

- Tabla: NIT, nombre, teléfono, email, estado. Búsqueda única (nombre o NIT) y paginación
  del servidor. Interruptor "Mostrar inactivos" solo para ADMIN.
- Diálogo de crear/editar: NIT, nombre, email, teléfono, dirección.
  - Botón "Consumidor final" que llena el NIT con `CF`.
  - El NIT lo normaliza el backend (sin guiones ni espacios, en mayúsculas). No se muestra
    una vista previa de la normalización (decisión del 2026-10-28).
- Desactivar: solo ADMIN, con confirmación.
- Detalle `/clientes/:id`: datos del cliente y sus últimas ventas (usa
  `GET /api/ventas?clienteId=`). Un VENDEDOR ve solo las ventas suyas, porque así lo filtra
  el backend; no hacer nada especial en el front.

## Criterios de aceptación

- Buscar "juan" o "PEREZ" encuentra a "Juan Pérez". La búsqueda no ignora tildes ("perez"
  no lo encuentra): el backend usa ILIKE sin unaccent, y se aceptó así (decisión del
  2026-10-28; ver docs/infra/pendientes.md §3).
- Crear un cliente con un NIT ya registrado muestra el 409 junto al campo NIT.
- Dos clientes con NIT `CF` se pueden crear sin error.
- El VENDEDOR no ve el botón de desactivar.
