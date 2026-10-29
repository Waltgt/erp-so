# Plan de módulos del backend

Cada archivo de esta carpeta es la especificación de un módulo. Claude Code los lee
junto con `CLAUDE.md` (raíz del repo). Se implementan en este orden, porque cada
uno depende de los anteriores:

| Orden | Archivo               | Depende de                     |
|-------|-----------------------|--------------------------------|
| 0     | 00-base.md            | Migraciones aplicadas          |
| 1     | 01-auth-usuarios.md   | 00                             |
| 2     | 02-clientes.md        | 01                             |
| 3     | 03-proveedores.md     | 01                             |
| 4     | 04-productos.md       | 03                             |
| 5     | 05-ventas.md          | 02, 04                         |
| 6     | 06-archivos.md        | 01 + Fase 4 (Garage) terminada |

## Instrucción para Claude Code (cambiar solo el nombre del archivo)

```
Lee CLAUDE.md y docs/modulos/00-base.md (convenciones comunes).
Implementa docs/modulos/<ARCHIVO>.md.

Trabaja por partes y DETENTE al terminar cada una para que yo revise:
  Parte 1: DTOs y validaciones.
  Parte 2: servicio con la lógica de negocio + pruebas unitarias del servicio.
  Parte 3: controlador con guards de rol y documentación Swagger.
  Parte 4: ejecuta npm run build, npm run lint y npm test; muéstrame el resultado.
  Parte 5: dame comandos curl para probar cada criterio de aceptación del archivo.

Si algo de la especificación es ambiguo o contradice CLAUDE.md, pregúntame antes
de decidir. Si necesitas cambiar schema.prisma, detente y explícame por qué.
Termina con una recapitulación: archivos creados, decisiones tomadas y pendientes.
```

## Cómo revisar cada parte

- Lee el código antes de aprobar. En la demo tendrás que explicarlo.
- Cada criterio de aceptación del módulo debe tener una prueba o un curl que lo demuestre.
- Commit al cerrar cada módulo: `feat(<modulo>): ...`
