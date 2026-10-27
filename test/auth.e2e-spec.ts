import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { configurarApp } from '../src/configurar-app';
import { Prisma, Rol, Usuario } from '../src/generated/prisma/client';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsuariosModule } from '../src/modules/usuarios/usuarios.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Módulos reales (guards, JWT, argon2, validación, filtro de errores);
// solo Prisma se reemplaza por un falso en memoria.

type Args = {
  where?: Partial<Pick<Usuario, 'id' | 'email' | 'activo'>>;
  data?: Partial<Usuario>;
  omit?: { passwordHash?: boolean };
  select?: Partial<Record<keyof Usuario, boolean>>;
  skip?: number;
  take?: number;
};

function crearPrismaFalso(usuarios: Usuario[]) {
  const proyectar = (u: Usuario, args: Args): Partial<Usuario> => {
    if (args.select) {
      return Object.fromEntries(
        Object.keys(args.select).map((k) => [k, u[k as keyof Usuario]]),
      );
    }
    const copia: Partial<Usuario> = { ...u };
    if (args.omit?.passwordHash) {
      delete copia.passwordHash;
    }
    return copia;
  };
  const coincide = (u: Usuario, where: Args['where'] = {}): boolean =>
    Object.entries(where).every(([k, v]) => u[k as keyof Usuario] === v);

  const falso = {
    usuario: {
      findUnique: (args: Args) => {
        const u = usuarios.find((x) => coincide(x, args.where));
        return Promise.resolve(u ? proyectar(u, args) : null);
      },
      findMany: (args: Args) =>
        Promise.resolve(
          usuarios
            .filter((u) => coincide(u, args.where))
            .slice(args.skip, (args.skip ?? 0) + (args.take ?? 100))
            .map((u) => proyectar(u, args)),
        ),
      count: (args: Args) =>
        Promise.resolve(usuarios.filter((u) => coincide(u, args.where)).length),
      update: (args: Args) => {
        const u = usuarios.find((x) => coincide(x, args.where));
        if (!u) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('No encontrado', {
              code: 'P2025',
              clientVersion: 'test',
            }),
          );
        }
        const definidos = Object.entries(args.data ?? {}).filter(
          ([, v]) => v !== undefined,
        );
        Object.assign(u, Object.fromEntries(definidos));
        return Promise.resolve(proyectar(u, args));
      },
    },
    // SELECT id FROM usuarios WHERE rol = 'ADMIN' AND activo FOR UPDATE
    $queryRaw: () =>
      Promise.resolve(
        usuarios
          .filter((u) => u.rol === Rol.ADMIN && u.activo)
          .map((u) => ({ id: u.id })),
      ),
    $transaction: (arg: unknown): Promise<unknown> =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: typeof falso) => Promise<unknown>)(falso),
  };
  return falso;
}

const PASSWORD = 'contraseña-larga-1';

describe('Auth y usuarios (e2e)', () => {
  let app: NestExpressApplication;
  let servidor: App;
  let usuarios: Usuario[];
  const respuestas: unknown[] = [];

  async function login(email: string, password = PASSWORD) {
    const res = await request(servidor)
      .post('/api/auth/login')
      .send({ email, password });
    respuestas.push(res.body);
    return res;
  }

  async function token(email: string): Promise<string> {
    const res = await login(email);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeEach(async () => {
    const passwordHash = await hash(PASSWORD);
    const fecha = new Date('2026-10-01T00:00:00Z');
    const base = {
      passwordHash,
      activo: true,
      creadoEn: fecha,
      actualizadoEn: fecha,
    };
    usuarios = [
      {
        id: 1,
        nombre: 'Admin',
        email: 'admin@empresa.com',
        rol: Rol.ADMIN,
        ...base,
      },
      {
        id: 2,
        nombre: 'Vera',
        email: 'vendedor@empresa.com',
        rol: Rol.VENDEDOR,
        ...base,
      },
    ];

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: crearPrismaFalso(usuarios) },
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
        UsuariosModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
    }).compile();

    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();
    servidor = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    // Criterio: ninguna respuesta contiene passwordHash
    expect(respuestas.length).toBeGreaterThan(10);
    for (const cuerpo of respuestas) {
      expect(JSON.stringify(cuerpo)).not.toMatch(/passwordHash|\$argon2/);
    }
  });

  async function get(ruta: string, jwt?: string) {
    const req = request(servidor).get(ruta);
    const res = await (jwt ? req.set('Authorization', `Bearer ${jwt}`) : req);
    respuestas.push(res.body);
    return res;
  }

  async function enviar(
    metodo: 'post' | 'patch' | 'delete',
    ruta: string,
    jwt: string,
    body?: object,
  ) {
    const res = await request(servidor)
      [metodo](ruta)
      .set('Authorization', `Bearer ${jwt}`)
      .send(body);
    respuestas.push(res.body);
    return res;
  }

  it('login correcto devuelve token y con él /auth/me responde 200', async () => {
    const res = await login('  ADMIN@Empresa.com ');
    expect(res.status).toBe(200);
    const cuerpo = res.body as { accessToken: unknown; usuario: unknown };
    expect(typeof cuerpo.accessToken).toBe('string');
    expect(cuerpo.usuario).toMatchObject({
      id: 1,
      email: 'admin@empresa.com',
      rol: 'ADMIN',
    });

    const me = await get(
      '/api/auth/me',
      (res.body as { accessToken: string }).accessToken,
    );
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: 1, email: 'admin@empresa.com' });
  });

  it('sin token: 401; con token inválido: 401', async () => {
    expect((await get('/api/auth/me')).status).toBe(401);
    expect((await get('/api/usuarios')).status).toBe(401);
    expect((await get('/api/auth/me', 'no.es.un-token')).status).toBe(401);
  });

  it('con token de VENDEDOR en /usuarios: 403', async () => {
    const jwt = await token('vendedor@empresa.com');
    expect((await get('/api/usuarios', jwt)).status).toBe(403);
    expect((await enviar('delete', '/api/usuarios/1', jwt)).status).toBe(403);
    // Pero /auth/me sí (cualquier rol autenticado)
    expect((await get('/api/auth/me', jwt)).status).toBe(200);
  });

  it('email inexistente y contraseña incorrecta: misma respuesta 401', async () => {
    const sinEmail = await login('nadie@empresa.com');
    const malaClave = await login('admin@empresa.com', 'otra-contraseña-9');
    const corta = await login('admin@empresa.com', 'x');

    for (const res of [sinEmail, malaClave, corta]) {
      expect(res.status).toBe(401);
    }
    expect(sinEmail.body).toEqual(malaClave.body);
    expect(corta.body).toEqual(malaClave.body);
  });

  it('el sexto intento de login en un minuto: 429 (throttler, sin Nginx)', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 7; i++) {
      estados.push((await login('nadie@empresa.com', 'x')).status);
    }
    expect(estados).toEqual([401, 401, 401, 401, 401, 429, 429]);

    // Bloqueado aunque ahora la contraseña sea la correcta
    const correcto = await login('admin@empresa.com');
    expect(correcto.status).toBe(429);
    expect((correcto.body as { message: string }).message).toMatch(
      /Demasiados intentos/,
    );
  });

  it('el límite es solo del login: el resto de la API no se limita', async () => {
    const jwt = await token('admin@empresa.com');
    for (let i = 0; i < 10; i++) {
      expect((await get('/api/auth/me', jwt)).status).toBe(200);
    }
  });

  it('login con un campo extra no declarado: 400', async () => {
    const res = await request(servidor)
      .post('/api/auth/login')
      .send({ email: 'admin@empresa.com', password: PASSWORD, esAdmin: true });
    respuestas.push(res.body);
    expect(res.status).toBe(400);
  });

  it('desactivar un usuario: su token deja de funcionar en la siguiente request', async () => {
    const admin = await token('admin@empresa.com');
    const vendedor = await token('vendedor@empresa.com');
    expect((await get('/api/auth/me', vendedor)).status).toBe(200);

    const res = await enviar('delete', '/api/usuarios/2', admin);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, activo: false });

    expect((await get('/api/auth/me', vendedor)).status).toBe(401);
    // Y tampoco puede volver a iniciar sesión (mismo 401 genérico)
    expect((await login('vendedor@empresa.com')).status).toBe(401);
  });

  it('degradar a un ADMIN surte efecto de inmediato (el rol se lee de la base)', async () => {
    usuarios.push({ ...usuarios[0], id: 3, email: 'otro@empresa.com' });
    const otro = await token('otro@empresa.com');
    expect((await get('/api/usuarios', otro)).status).toBe(200);

    const admin = await token('admin@empresa.com');
    await enviar('patch', '/api/usuarios/3', admin, { rol: 'VENDEDOR' });

    expect((await get('/api/usuarios', otro)).status).toBe(403);
  });

  it('intentar desactivar al último admin: 409', async () => {
    const admin = await token('admin@empresa.com');
    const porDelete = await enviar('delete', '/api/usuarios/1', admin);
    const porPatch = await enviar('patch', '/api/usuarios/1', admin, {
      activo: false,
    });
    const degradar = await enviar('patch', '/api/usuarios/1', admin, {
      rol: 'VENDEDOR',
    });
    for (const res of [porDelete, porPatch, degradar]) {
      expect(res.status).toBe(409);
    }
    expect(usuarios[0].activo).toBe(true);
  });

  it('PATCH con body vacío: 400; id no numérico: 400; id inexistente: 404', async () => {
    const admin = await token('admin@empresa.com');
    expect((await enviar('patch', '/api/usuarios/2', admin, {})).status).toBe(
      400,
    );
    expect((await get('/api/usuarios/abc', admin)).status).toBe(400);
    expect((await get('/api/usuarios/99', admin)).status).toBe(404);
    expect(
      (await enviar('patch', '/api/usuarios/99', admin, { nombre: 'X' }))
        .status,
    ).toBe(404);
  });

  it('listado paginado de usuarios (ADMIN) sin passwordHash', async () => {
    const admin = await token('admin@empresa.com');
    const res = await get('/api/usuarios?page=1&limit=1', admin);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect((res.body as { data: unknown[] }).data).toHaveLength(1);
  });

  it('cambiar la propia contraseña: 204 y la nueva sirve para el login', async () => {
    const jwt = await token('vendedor@empresa.com');
    const mal = await enviar('patch', '/api/auth/password', jwt, {
      passwordActual: 'incorrecta-123',
      passwordNueva: 'nueva-contraseña-2',
    });
    expect(mal.status).toBe(400);

    const ok = await enviar('patch', '/api/auth/password', jwt, {
      passwordActual: PASSWORD,
      passwordNueva: 'nueva-contraseña-2',
    });
    expect(ok.status).toBe(204);
    expect(
      (await login('vendedor@empresa.com', 'nueva-contraseña-2')).status,
    ).toBe(200);
    expect((await login('vendedor@empresa.com')).status).toBe(401);
  });
});
