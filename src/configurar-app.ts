import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const PREFIJO_API = 'api';
export const RUTA_DOCS = `${PREFIJO_API}/docs`;

// Configuración común de la app. La usan main.ts y las pruebas e2e,
// para que ambas validen exactamente igual.
export function configurarApp(app: NestExpressApplication): void {
  // Detrás de Nginx: req.ip y req.protocol vienen de X-Forwarded-*
  app.set('trust proxy', 1);
  app.use(helmet());
  app.setGlobalPrefix(PREFIJO_API);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Sin CORS: en producción Nginx sirve front y API en el mismo origen;
  // en desarrollo el front usa el proxy de Vite.
}

// Swagger solo fuera de producción (lo decide main.ts según NODE_ENV)
export function configurarSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('ERP – API')
    .setDescription('Backend del ERP (Práctica 3)')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(RUTA_DOCS, app, documento);
}
