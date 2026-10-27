# 00 – Base del proyecto (convenciones comunes)

Este módulo no tiene lógica de negocio: prepara lo que usan todos los demás.

## Configuración

- `@nestjs/config` con validación de variables al arrancar (si falta una, la app NO arranca):
  `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres), `JWT_EXPIRES_IN`, `PORT`.
  Las variables de MinIO se agregan en el módulo 06.
- Actualizar `.env.example` con cada variable nueva (con valor `CAMBIAR`).

## Prisma

- `PrismaService` que extiende el cliente generado en `src/generated/prisma`, creado con
  `new PrismaPg({ connectionString: DATABASE_URL }, { schema: 'erp' })`.
- Conectar en `onModuleInit`, desconectar en `onModuleDestroy`. Módulo global.
- Riesgo conocido: el generador `prisma-client` de Prisma 7 y el módulo CommonJS de Nest
  pueden chocar al importar. Si aparece un error de importación/ESM, revisa la documentación
  actual de Prisma 7 (opción de formato de módulo del generador) y explícame la solución
  antes de aplicarla.

## Arranque (main.ts)

- `ValidationPipe` global: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- `app.set('trust proxy', 1)` (detrás de Nginx).
- `helmet`.
- Swagger en `/api/docs` SOLO si `NODE_ENV !== 'production'`.
- Prefijo global `/api`.
- Sin CORS en producción (Nginx sirve front y API en el mismo origen). En desarrollo,
  el front usa el proxy de Vite.

## Filtro global de errores de Prisma

| Código Prisma | HTTP | Mensaje                                   |
|---------------|------|-------------------------------------------|
| P2002         | 409  | Registro duplicado (indicar el campo)     |
| P2003         | 409  | No se puede: hay registros relacionados   |
| P2025         | 404  | No encontrado                             |
| Violación de CHECK (código de PostgreSQL 23514) | 409 | Regla de integridad violada |
| Otro          | 500  | Error interno (sin detalles al cliente; sí en el log) |

## Convenciones de API

- Estructura: `src/modules/<modulo>/{dto/, <modulo>.controller.ts, <modulo>.service.ts, <modulo>.service.spec.ts}`.
- Paginación en todos los listados: `?page=1&limit=20`, `limit` máximo 100.
  Respuesta: `{ data: [...], total, page, limit }`.
- Dinero: entra como string o number con máximo 2 decimales; sale como string (Decimal).
  Nunca usar `number` de JS para cálculos de dinero: usar `Prisma.Decimal`.
- IDs numéricos en rutas: `ParseIntPipe`.
- Fechas en ISO 8601 con zona horaria.
- Borrado lógico: `DELETE` pone `activo = false`. Los listados devuelven solo activos,
  salvo `?incluirInactivos=true` (solo ADMIN).

## Criterios de aceptación

- `npm run start:dev` arranca y se conecta a la base.
- Si se borra `JWT_SECRET` del `.env`, la app no arranca y dice qué falta.
- `GET /api/docs` muestra Swagger en desarrollo.
- Un body con un campo extra no declarado responde 400.
