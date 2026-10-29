import { Global, InjectionToken, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaExceptionFilter } from '../../src/common/filters/prisma-exception.filter';
import { configurarApp } from '../../src/configurar-app';
import { Rol } from '../../src/generated/prisma/client';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// App de prueba para e2e de módulos: guards, JWT, validación y filtro
// reales; Prisma lo pone cada prueba (un falso en memoria).
// Hay un usuario activo por rol, con id = posición en ROLES + 1.
export const ROLES = [Rol.ADMIN, Rol.VENDEDOR, Rol.BODEGUERO, Rol.COMPRAS];

const FECHA = new Date('2026-10-01T00:00:00Z');

// usuario.findUnique por id, que es lo que usa la estrategia JWT
export const usuariosFalsos = {
  findUnique: ({ where }: { where: { id: number } }) => {
    const rol = ROLES[where.id - 1];
    return Promise.resolve(
      rol
        ? {
            id: where.id,
            nombre: rol,
            email: `${rol.toLowerCase()}@empresa.com`,
            rol,
            activo: true,
            creadoEn: FECHA,
            actualizadoEn: FECHA,
          }
        : null,
    );
  },
};

// Variables de entorno extra y proveedores reemplazados por un doble
// (ej. el almacenamiento S3 por uno en memoria)
export interface OpcionesAppPrueba {
  config?: Record<string, unknown>;
  reemplazos?: [token: InjectionToken, valor: unknown][];
}

export interface AppPrueba {
  app: NestExpressApplication;
  // Cabecera Authorization, para armar peticiones a mano (ej. multipart)
  auth: (rol: Rol) => string;
  sinToken: () => request.Agent;
  como: (rol: Rol) => {
    get: (ruta: string) => request.Test;
    post: (ruta: string, body: object) => request.Test;
    patch: (ruta: string, body: object) => request.Test;
    delete: (ruta: string) => request.Test;
  };
}

export async function crearAppPrueba(
  modulos: Type[],
  prismaFalso: object,
  opciones: OpcionesAppPrueba = {},
): Promise<AppPrueba> {
  @Global()
  @Module({
    providers: [
      {
        provide: PrismaService,
        useValue: { usuario: usuariosFalsos, ...prismaFalso },
      },
    ],
    exports: [PrismaService],
  })
  class PrismaFalsoModule {}

  const definicion = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            JWT_SECRET: 'x'.repeat(32),
            JWT_EXPIRES_IN: '1h',
            ...opciones.config,
          }),
        ],
      }),
      PrismaFalsoModule,
      AuthModule,
      ...modulos,
    ],
    providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
  });
  for (const [token, valor] of opciones.reemplazos ?? []) {
    definicion.overrideProvider(token).useValue(valor);
  }
  const modulo = await definicion.compile();

  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  const servidor = app.getHttpServer() as App;

  const jwt = app.get(JwtService);
  const tokens = new Map<Rol, string>();
  for (const [i, rol] of ROLES.entries()) {
    tokens.set(rol, await jwt.signAsync({ sub: i + 1, rol }));
  }

  return {
    app,
    auth: (rol) => `Bearer ${tokens.get(rol)}`,
    sinToken: () => request.agent(servidor),
    como: (rol: Rol) => {
      const auth = `Bearer ${tokens.get(rol)}`;
      return {
        get: (ruta) => request(servidor).get(ruta).set('Authorization', auth),
        post: (ruta, body) =>
          request(servidor).post(ruta).set('Authorization', auth).send(body),
        patch: (ruta, body) =>
          request(servidor).patch(ruta).set('Authorization', auth).send(body),
        delete: (ruta) =>
          request(servidor).delete(ruta).set('Authorization', auth),
      };
    },
  };
}
