# 01 – Login, perfil y usuarios

Backend: docs/modulos/01-auth-usuarios.md

## Pantallas

| Ruta              | Roles  | Contenido                                       |
|-------------------|--------|-------------------------------------------------|
| /login            | Pública| Email, contraseña, botón Ingresar               |
| /perfil           | Todos  | Datos del usuario y cambio de la propia contraseña |
| /usuarios         | ADMIN  | Tabla de usuarios                               |
| /sin-permiso      | Todos  | Mensaje y botón para volver al inicio           |

## Login

- Si ya hay sesión, `/login` redirige al inicio.
- Un solo mensaje para credenciales inválidas: "Email o contraseña incorrectos"
  (el backend no distingue los casos y el front tampoco debe hacerlo).
- 429: "Demasiados intentos. Espera un minuto." y deshabilitar el botón 60 s.
- Al ingresar, volver a la ruta guardada (si la sesión había expirado) o al inicio.

## Perfil

- Muestra nombre, email y rol (solo lectura).
- Cambio de contraseña: actual, nueva y confirmación. Mínimo 10 caracteres; la nueva y
  la confirmación deben coincidir. Al terminar, aviso de éxito y limpiar el formulario.

## Usuarios (ADMIN)

- Tabla: nombre, email, rol (etiqueta de color por rol), estado (activo/inactivo), fecha
  de creación. Interruptor "Mostrar inactivos". Sin filtro por texto ni por rol:
  `GET /api/usuarios` no ofrece `?buscar=` ni `?rol=` (decisión del 2026-10-28).
- Crear y editar en un diálogo: nombre, email, rol y (solo al crear) contraseña con
  confirmación. En edición, el email no se puede cambiar. La contraseña de otro
  usuario se cambia con "Restablecer contraseña".
- Acciones por fila: editar, activar/desactivar (con confirmación), restablecer contraseña.
- En la fila del propio usuario: deshabilitar "desactivar" (con un tooltip que explique
  por qué) y el cambio de rol (con un texto de ayuda bajo el selector del diálogo).
- Si el backend responde 409 (último admin), mostrar su mensaje.

## Criterios de aceptación

- Login correcto lleva al inicio; el menú muestra solo las opciones del rol.
- Seis intentos fallidos seguidos: el sexto muestra el aviso de espera.
- Un VENDEDOR que escribe /usuarios en la barra de direcciones termina en /sin-permiso.
- Crear un usuario con un email repetido muestra el mensaje 409 junto al campo email.
- Desactivar a otro usuario: el estado cambia en la tabla sin recargar la página.
- Las contraseñas nunca aparecen en la tabla ni en la consola del navegador.
