import {
  INestApplication,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const PREFIJO_API = 'api';
export const RUTA_DOCS = `${PREFIJO_API}/docs`;

// También las usa POST /archivos para validar los campos del multipart,
// que no pasan por el pipe global
export const OPCIONES_VALIDACION: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

// Configuración común de la app. La usan main.ts y las pruebas e2e,
// para que ambas validen exactamente igual.
//
// trustProxy = TRUST_PROXY: cuántos proxies hay delante (Nginx = 1). Lo pasa
// main.ts; las pruebas e2e usan el valor por defecto.
export function configurarApp(
  app: NestExpressApplication,
  trustProxy = 1,
): void {
  // Detrás de Nginx: req.ip y req.protocol vienen de X-Forwarded-*
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.setGlobalPrefix(PREFIJO_API);
  app.useGlobalPipes(new ValidationPipe(OPCIONES_VALIDACION));
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
