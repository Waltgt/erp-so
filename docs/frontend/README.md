# Plan del frontend (Vue 3)

El frontend vive en la carpeta `frontend/` del mismo repositorio, con su propio
`package.json`. Cada archivo de `docs/frontend/` especifica una parte. Se implementan
en este orden; cada pantalla requiere que su módulo del backend ya funcione:

| Orden | Archivo               | Requiere en el backend            |
|-------|-----------------------|-----------------------------------|
| 0     | 00-base.md            | Módulo 01 (login)                 |
| 1     | 01-login-usuarios.md  | Módulo 01                         |
| 2     | 02-clientes.md        | Módulo 02                         |
| 3     | 03-proveedores.md     | Módulo 03                         |
| 4     | 04-productos.md       | Módulo 04                         |
| 5     | 05-ventas.md          | Módulo 05                         |
| 6     | 06-archivos.md        | Módulo 06 con URL firmada         |

## Instrucción para Claude Code (cambiar solo el nombre del archivo)

```
Lee CLAUDE.md y docs/frontend/00-base.md (convenciones del frontend).
Implementa docs/frontend/<ARCHIVO>.md dentro de la carpeta frontend/.
Revisa también el módulo del backend correspondiente en docs/modulos/ para
usar exactamente sus rutas, campos y códigos de error.

Trabaja por partes y DETENTE al terminar cada una para que yo revise:
  Parte 1: tipos TypeScript y funciones de la API (src/api/).
  Parte 2: store o composables, si la pantalla los necesita.
  Parte 3: vistas y componentes.
  Parte 4: ejecuta npm run type-check, npm run lint y npm run build dentro de
           frontend/ y muéstrame el resultado.
  Parte 5: dame una lista de verificación manual (qué hacer en el navegador
           y qué debe pasar) para cada criterio de aceptación.

No modifiques nada fuera de frontend/. Si la pantalla necesita algo que el
backend no ofrece, detente y explícame qué falta en lugar de inventarlo.
Termina con una recapitulación: archivos creados, decisiones y pendientes.
```

## Reglas del frontend para agregar a CLAUDE.md

```
11. Frontend en frontend/ (Vue 3 + Vite + TypeScript + PrimeVue). Las
    especificaciones están en docs/frontend/. Ejecuta los comandos npm del
    frontend DENTRO de frontend/, y los del backend en la raíz.
12. El frontend nunca decide permisos por sí solo: oculta lo que el rol no
    puede usar, pero la autorización real es siempre del backend.
13. Prohibido v-html con datos que vengan de la API o del usuario.
```
