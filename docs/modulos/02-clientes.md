# 02 – Clientes

## Endpoints

| Método | Ruta               | Roles           |
|--------|--------------------|-----------------|
| GET    | /api/clientes      | ADMIN, VENDEDOR |
| GET    | /api/clientes/:id  | ADMIN, VENDEDOR |
| POST   | /api/clientes      | ADMIN, VENDEDOR |
| PATCH  | /api/clientes/:id  | ADMIN, VENDEDOR |
| DELETE | /api/clientes/:id  | ADMIN           |

Listado con `?buscar=` (nombre o NIT, sin distinguir mayúsculas) y paginación.

## Reglas de negocio

- NIT: normalizar antes de guardar y de buscar: `trim`, mayúsculas, sin espacios ni guiones.
- `CF` (consumidor final) puede repetirse; cualquier otro NIT es único
  (lo garantiza el índice `clientes_nit_unico`; el P2002 se traduce a 409 "NIT ya registrado").
- Email opcional; si viene, formato válido y en minúsculas.
- `DELETE` es borrado lógico. Un cliente inactivo no aparece en el listado y no se puede
  usar en ventas nuevas, pero sus ventas anteriores siguen visibles.

## Criterios de aceptación

- Crear dos clientes con NIT `CF`: ambos 201.
- Crear dos clientes con NIT `1234567-8` y `12345678`: el segundo da 409 (misma normalización).
- `?buscar=perez` encuentra a "Juan Pérez" si el nombre se guardó con tilde: documenta en la
  recapitulación si la búsqueda ignora tildes o no (es aceptable que no, pero hay que decirlo).
- BODEGUERO en `/api/clientes`: 403.
- Cliente borrado: no sale en el listado; `GET /:id` sigue respondiendo (para ver historial).
