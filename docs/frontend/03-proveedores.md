# 03 – Proveedores

Backend: docs/modulos/03-proveedores.md

## Pantalla `/proveedores` (ADMIN, COMPRAS escriben; BODEGUERO solo lee)

- Tabla: NIT, nombre, contacto, teléfono, email, productos activos, estado.
  Búsqueda y paginación del servidor.
- Diálogo crear/editar: NIT, nombre, contacto, teléfono, email, dirección.
  No ofrecer "CF" (el backend lo rechaza para proveedores).
- Desactivar con confirmación. Si la respuesta indica productos activos asociados,
  mostrar un aviso: "El proveedor quedó inactivo pero tiene N productos activos".
- BODEGUERO: la misma tabla sin botones de crear, editar ni desactivar.

## Criterios de aceptación

- NIT `CF`: el formulario muestra el error del backend.
- BODEGUERO ve la tabla pero ninguna acción de escritura.
- Desactivar un proveedor con productos muestra el aviso con el número correcto.
