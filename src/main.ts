import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Entorno, VariablesEntorno } from './config/env.validation';
import {
  configurarApp,
  configurarSwagger,
  PREFIJO_API,
  RUTA_DOCS,
} from './configurar-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<VariablesEntorno, true>);
  const logger = new Logger('Bootstrap');

  configurarApp(app, config.get('TRUST_PROXY', { infer: true }));

  const entorno = config.get('NODE_ENV', { infer: true });
  if (entorno !== Entorno.Production) {
    configurarSwagger(app);
  }

  // Ejecuta onModuleDestroy (desconexión de Prisma) al recibir SIGTERM/SIGINT
  app.enableShutdownHooks();

  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);

  logger.log(`API en http://localhost:${puerto}/${PREFIJO_API} (${entorno})`);
  if (entorno !== Entorno.Production) {
    logger.log(`Swagger en http://localhost:${puerto}/${RUTA_DOCS}`);
  }
}

void bootstrap();
