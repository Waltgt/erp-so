# 00 – Base del frontend

## Stack

- Vue 3 (Composition API, `<script setup lang="ts">`) + Vite + TypeScript estricto.
- Vue Router, Pinia.
- PrimeVue (versión actual) con PrimeIcons y un tema preestablecido. Verifica en la
  documentación oficial de PrimeVue la forma vigente de instalar el tema antes de hacerlo.
- Cliente HTTP: axios, con una sola instancia en `src/api/http.ts`.
- Vitest para pruebas de utilidades y stores.
- Crear el proyecto con el generador oficial de Vue (`npm create vue@latest`) dentro de
  `frontend/`, con TypeScript, Router, Pinia, Vitest y ESLint.

## Estructura

```
frontend/src/
  api/          http.ts + un archivo por recurso (clientes.ts, ventas.ts...)
  types/        tipos de la API (iguales a los DTO y respuestas del backend)
  stores/       auth.ts (y otros solo si hacen falta)
  composables/  useTablaPaginada.ts, useApiError.ts, useFormato.ts
  layouts/      LayoutPrincipal.vue (menú lateral + barra superior)
  views/        una carpeta por módulo
  components/   componentes reutilizables
  router/       index.ts con guards
```

## Desarrollo y producción

- Desarrollo: el proxy de Vite envía `/api` a `http://localhost:3000` (el backend en la PC).
  Nunca escribir la URL del backend dentro del código: todas las llamadas usan rutas
  relativas `/api/...`.
- Producción: `npm run build` genera `frontend/dist/`, que Nginx sirve en server-web
  (fase 6). Front y API quedan en el mismo origen, así que no hace falta CORS.

## Sesión (decisión: token en localStorage)

- El store `auth` guarda `accessToken` y `usuario` en memoria y una copia en `localStorage`
  (clave `erp.sesion`), para sobrevivir a la recarga de la página.
- Al arrancar la app: si hay sesión guardada, llamar a `GET /api/auth/me`. Si responde 401,
  borrar la sesión y enviar al login. Así se detecta un token vencido o un usuario desactivado.
- El interceptor de axios agrega `Authorization: Bearer <token>`.
- Cualquier 401 en cualquier llamada: borrar la sesión, ir a `/login` con un aviso
  "Tu sesión terminó" y guardar la ruta actual para volver a ella después del login.
- Cerrar sesión: borrar memoria y `localStorage`, y navegar a `/login`.
- Riesgo aceptado y documentado: un ataque XSS podría leer el token de `localStorage`.
  Mitigaciones obligatorias:
  - Prohibido `v-html` con datos de la API o del usuario (Vue escapa todo lo demás).
  - Nunca poner el token en una URL ni en un log de consola.
  - Nginx enviará una Content-Security-Policy estricta (anotar en docs/infra/pendientes.md
    si no está).

## Roles y navegación

- El menú se arma según `usuario.rol`. Cada ruta declara `meta.roles`; el guard del router
  redirige a `/sin-permiso` si el rol no está incluido. Esto es solo comodidad visual: la
  seguridad real la pone el backend (un 403 del backend se muestra como aviso).

| Menú         | ADMIN | VENDEDOR | BODEGUERO | COMPRAS |
|--------------|:-----:|:--------:|:---------:|:-------:|
| Inicio       | ✔ | ✔ | ✔ | ✔ |
| Ventas       | ✔ | ✔ |   |   |
| Clientes     | ✔ | ✔ |   |   |
| Productos    | ✔ | ✔ | ✔ | ✔ |
| Proveedores  | ✔ |   | ✔ | ✔ |
| Archivos     | ✔ | ✔ | ✔ | ✔ |
| Usuarios     | ✔ |   |   |   |

- Inicio: saludo con el nombre y el rol, y accesos directos a las pantallas del rol.
  Si el rol puede ver `stock-bajo`, mostrar una tarjeta con la cantidad de productos en stock bajo.

## Convenciones

- Listados: `DataTable` de PrimeVue en modo `lazy`, con paginación del servidor
  (`page`, `limit`), conectado a `{ data, total, page, limit }` mediante `useTablaPaginada`.
  La búsqueda espera 300 ms después de la última tecla antes de consultar.
- Errores: `useApiError` traduce la respuesta del backend a un `Toast`:
  400 → mensajes de validación junto a cada campo cuando sea posible; 403 → "No tienes
  permiso"; 404 → "No encontrado"; 409 → el mensaje del backend; 413/415 → el mensaje del
  backend; 429 → "Demasiados intentos, espera un momento"; 500 → mensaje genérico.
- Dinero: el backend lo envía como string. Mostrarlo con
  `Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })`. No hacer cálculos
  de dinero con `number` para guardar: el total oficial siempre es el que devuelve el backend.
- Fechas: mostrar en la zona `America/Guatemala`, formato `dd/MM/yyyy HH:mm`.
- Formularios: validar en el cliente lo mismo que valida el backend (para avisar antes),
  pero tratar la respuesta del servidor como la autoridad final.
- Acciones destructivas (desactivar, anular, borrar): siempre con `ConfirmDialog`.
- Botones de guardar: deshabilitados mientras la petición está en curso (evita dobles envíos).
- Responsivo: usable en una pantalla de 1366 px y en una tablet; el menú lateral se colapsa.

## Criterios de aceptación

- `npm run dev` levanta el front y las llamadas a `/api` llegan al backend.
- Sin sesión, cualquier ruta interna redirige a `/login`.
- Recargar la página con sesión activa mantiene al usuario dentro.
- Borrar el token a mano en localStorage y navegar: vuelve al login.
- `npm run type-check`, `npm run lint` y `npm run build` terminan sin errores.
