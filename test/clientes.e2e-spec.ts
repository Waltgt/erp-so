import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { configurarApp } from '../src/configurar-app';
import { Cliente, Rol } from '../src/generated/prisma/client';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ClientesModule } from '../src/modules/clientes/clientes.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Guards, JWT, validación y filtro reales; Prisma en memoria. Los usuarios
// tienen id = posición del rol + 1 (ADMIN=1, VENDEDOR=2, ...).
const ROLES = [Rol.ADMIN, Rol.VENDEDOR, Rol.BODEGUERO, Rol.COMPRAS];

function crearPrismaFalso(clientes: Cliente[]) {
  const fecha = new Date('2026-10-01T00:00:00Z');
  type Where = { id?: number; activo?: boolean };
  const coincide = (c: Cliente, where: Where = {}) =>
    (where.id === undefined || c.id === where.id) &&
    (where.activo === undefined || c.activo === where.activo);

  const falso = {
    usuario: {
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
                creadoEn: fecha,
                actualizadoEn: fecha,
              }
            : null,
        );
      },
    },
    cliente: {
      findMany: ({ where }: { where: Where }) =>
        Promise.resolve(clientes.filter((c) => coincide(c, where))),
      count: ({ where }: { where: Where }) =>
        Promise.resolve(clientes.filter((c) => coincide(c, where)).length),
      findUnique: ({ where }: { where: Where }) =>
        Promise.resolve(clientes.find((c) => c.id === where.id) ?? null),
      create: ({ data }: { data: Partial<Cliente> }) => {
        const nuevo = {
          ...data,
          id: clientes.length + 1,
          activo: true,
          creadoEn: fecha,
          actualizadoEn: fecha,
        } as Cliente;
        clientes.push(nuevo);
        return Promise.resolve(nuevo);
      },
      update: ({ where, data }: { where: Where; data: Partial<Cliente> }) => {
        const c = clientes.find((x) => x.id === where.id);
        const definidos = Object.entries(data).filter(
          ([, v]) => v !== undefined,
        );
        Object.assign(c ?? {}, Object.fromEntries(definidos));
        return Promise.resolve(c);
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return falso;
}

describe('Clientes (e2e)', () => {
  let app: NestExpressApplication;
  let servidor: App;
  let clientes: Cliente[];
  const token: Partial<Record<Rol, string>> = {};

  beforeEach(async () => {
    const fecha = new Date('2026-10-01T00:00:00Z');
    clientes = [
      {
        id: 1,
        nit: 'CF',
        nombre: 'Juan Pérez',
        email: null,
        telefono: null,
        direccion: null,
        activo: true,
        creadoEn: fecha,
        actualizadoEn: fecha,
      },
    ];

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: crearPrismaFalso(clientes) },
      ],
      exports: [PrismaService],
    })
    class PrismaFalsoModule {}

    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'x'.repeat(32), JWT_EXPIRES_IN: '1h' })],
        }),
        PrismaFalsoModule,
        AuthModule,
        ClientesModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
    }).compile();

    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();
    servidor = app.getHttpServer();

    const jwt = app.get(JwtService);
    for (const [i, rol] of ROLES.entries()) {
      token[rol] = await jwt.signAsync({ sub: i + 1, rol });
    }
  });

  afterEach(async () => {
    await app.close();
  });

  const como = (rol: Rol) => ({
    get: (ruta: string) =>
      request(servidor).get(ruta).set('Authorization', `Bearer ${token[rol]}`),
    post: (ruta: string, body: object) =>
      request(servidor)
        .post(ruta)
        .set('Authorization', `Bearer ${token[rol]}`)
        .send(body),
    patch: (ruta: string, body: object) =>
      request(servidor)
        .patch(ruta)
        .set('Authorization', `Bearer ${token[rol]}`)
        .send(body),
    delete: (ruta: string) =>
      request(servidor)
        .delete(ruta)
        .set('Authorization', `Bearer ${token[rol]}`),
  });

  it('sin token: 401', () => {
    return request(servidor).get('/api/clientes').expect(401);
  });

  it.each([Rol.BODEGUERO, Rol.COMPRAS])(
    '%s en /api/clientes: 403 en todos los endpoints',
    async (rol) => {
      const r = como(rol);
      expect((await r.get('/api/clientes')).status).toBe(403);
      expect((await r.get('/api/clientes/1')).status).toBe(403);
      expect(
        (await r.post('/api/clientes', { nit: 'CF', nombre: 'X' })).status,
      ).toBe(403);
      expect((await r.patch('/api/clientes/1', { nombre: 'X' })).status).toBe(
        403,
      );
      expect((await r.delete('/api/clientes/1')).status).toBe(403);
    },
  );

  it('VENDEDOR: lista, ve, crea y edita, pero NO borra', async () => {
    const r = como(Rol.VENDEDOR);
    expect((await r.get('/api/clientes')).status).toBe(200);
    expect((await r.get('/api/clientes/1')).status).toBe(200);

    const creado = await r.post('/api/clientes', {
      nit: ' 1234567-8 ',
      nombre: ' Ana López ',
      email: 'Ana@Correo.COM',
    });
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({
      nit: '12345678',
      nombre: 'Ana López',
      email: 'ana@correo.com',
      telefono: null,
    });

    expect(
      (await r.patch('/api/clientes/1', { telefono: '5555-1234' })).status,
    ).toBe(200);
    expect((await r.delete('/api/clientes/1')).status).toBe(403);
    expect(clientes[0].activo).toBe(true);
  });

  it('ADMIN borra (lógico): no sale en el listado y GET /:id sigue respondiendo', async () => {
    const r = como(Rol.ADMIN);
    const borrado = await r.delete('/api/clientes/1');
    expect(borrado.status).toBe(200);
    expect(borrado.body).toMatchObject({ id: 1, activo: false });

    const lista = await r.get('/api/clientes');
    expect(lista.body).toMatchObject({ total: 0, data: [] });

    const detalle = await r.get('/api/clientes/1');
    expect(detalle.status).toBe(200);
    expect(detalle.body).toMatchObject({ activo: false });
  });

  it('incluirInactivos: ADMIN 200, VENDEDOR 403', async () => {
    clientes[0].activo = false;
    const admin = await como(Rol.ADMIN).get(
      '/api/clientes?incluirInactivos=true',
    );
    expect(admin.status).toBe(200);
    expect(admin.body).toMatchObject({ total: 1 });

    expect(
      (await como(Rol.VENDEDOR).get('/api/clientes?incluirInactivos=true'))
        .status,
    ).toBe(403);
  });

  it('reactivar: ADMIN con PATCH activo=true; VENDEDOR 403', async () => {
    clientes[0].activo = false;
    expect(
      (await como(Rol.VENDEDOR).patch('/api/clientes/1', { activo: true }))
        .status,
    ).toBe(403);
    expect(clientes[0].activo).toBe(false);

    const res = await como(Rol.ADMIN).patch('/api/clientes/1', {
      activo: true,
    });
    expect(res.status).toBe(200);
    expect(clientes[0].activo).toBe(true);
  });

  it('validaciones: body vacío, campo extra, nit null e id no numérico → 400', async () => {
    const r = como(Rol.VENDEDOR);
    expect((await r.patch('/api/clientes/1', {})).status).toBe(400);
    expect(
      (await r.post('/api/clientes', { nit: 'CF', nombre: 'X', saldo: 10 }))
        .status,
    ).toBe(400);
    expect((await r.patch('/api/clientes/1', { nit: null })).status).toBe(400);
    expect((await r.get('/api/clientes/abc')).status).toBe(400);
  });

  it('cliente inexistente: 404', async () => {
    expect((await como(Rol.VENDEDOR).get('/api/clientes/99')).status).toBe(404);
  });
});
