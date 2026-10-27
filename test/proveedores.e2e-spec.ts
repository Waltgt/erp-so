import { Prisma, Proveedor, Rol } from '../src/generated/prisma/client';
import { ProveedoresModule } from '../src/modules/proveedores/proveedores.module';
import { AppPrueba, crearAppPrueba } from './utils/app-prueba';

type Where = { id?: number; activo?: boolean };

function crearPrismaFalso(proveedores: Proveedor[], productosActivos: number) {
  const coincide = (p: Proveedor, where: Where = {}) =>
    (where.id === undefined || p.id === where.id) &&
    (where.activo === undefined || p.activo === where.activo);
  const conConteo = (p: Proveedor, args: { include?: unknown }) =>
    args.include ? { ...p, _count: { productos: productosActivos } } : p;
  const fecha = new Date('2026-10-01T00:00:00Z');

  return {
    proveedor: {
      findMany: ({ where }: { where: Where }) =>
        Promise.resolve(proveedores.filter((p) => coincide(p, where))),
      count: ({ where }: { where: Where }) =>
        Promise.resolve(proveedores.filter((p) => coincide(p, where)).length),
      findUnique: (args: { where: Where; include?: unknown }) => {
        const p = proveedores.find((x) => x.id === args.where.id);
        return Promise.resolve(p ? conConteo(p, args) : null);
      },
      create: ({ data }: { data: Partial<Proveedor> }) => {
        if (proveedores.some((p) => p.nit === data.nit)) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('duplicado', {
              code: 'P2002',
              clientVersion: 'test',
              meta: {
                driverAdapterError: {
                  cause: { constraint: { index: 'proveedores_nit_key' } },
                },
              },
            }),
          );
        }
        const nuevo = {
          ...data,
          id: proveedores.length + 1,
          activo: true,
          creadoEn: fecha,
          actualizadoEn: fecha,
        } as Proveedor;
        proveedores.push(nuevo);
        return Promise.resolve(nuevo);
      },
      update: (args: {
        where: Where;
        data: Partial<Proveedor>;
        include?: unknown;
      }) => {
        const p = proveedores.find((x) => x.id === args.where.id);
        if (!p) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('no existe', {
              code: 'P2025',
              clientVersion: 'test',
            }),
          );
        }
        const definidos = Object.entries(args.data).filter(
          ([, v]) => v !== undefined,
        );
        Object.assign(p, Object.fromEntries(definidos));
        return Promise.resolve(conConteo(p, args));
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

describe('Proveedores (e2e)', () => {
  let prueba: AppPrueba;
  let proveedores: Proveedor[];

  beforeEach(async () => {
    const fecha = new Date('2026-10-01T00:00:00Z');
    proveedores = [
      {
        id: 1,
        nit: '12345678',
        nombre: 'Distribuidora El Sol',
        contacto: null,
        telefono: null,
        email: null,
        direccion: null,
        activo: true,
        creadoEn: fecha,
        actualizadoEn: fecha,
      },
    ];
    prueba = await crearAppPrueba(
      [ProveedoresModule],
      crearPrismaFalso(proveedores, 3),
    );
  });

  afterEach(async () => {
    await prueba.app.close();
  });

  it('sin token: 401', async () => {
    expect((await prueba.sinToken().get('/api/proveedores')).status).toBe(401);
  });

  it('VENDEDOR en /api/proveedores: 403 en todos los endpoints', async () => {
    const r = prueba.como(Rol.VENDEDOR);
    expect((await r.get('/api/proveedores')).status).toBe(403);
    expect((await r.get('/api/proveedores/1')).status).toBe(403);
    expect(
      (await r.post('/api/proveedores', { nit: '987654', nombre: 'X' })).status,
    ).toBe(403);
    expect((await r.patch('/api/proveedores/1', { nombre: 'X' })).status).toBe(
      403,
    );
    expect((await r.delete('/api/proveedores/1')).status).toBe(403);
  });

  it('BODEGUERO puede listar y ver, pero un POST suyo da 403', async () => {
    const r = prueba.como(Rol.BODEGUERO);
    expect((await r.get('/api/proveedores')).status).toBe(200);
    expect((await r.get('/api/proveedores/1')).status).toBe(200);
    expect(
      (await r.post('/api/proveedores', { nit: '987654', nombre: 'X' })).status,
    ).toBe(403);
    expect((await r.patch('/api/proveedores/1', { nombre: 'X' })).status).toBe(
      403,
    );
    expect((await r.delete('/api/proveedores/1')).status).toBe(403);
  });

  it.each([Rol.ADMIN, Rol.COMPRAS])(
    '%s crea, edita, desactiva y reactiva',
    async (rol) => {
      const r = prueba.como(rol);
      const creado = await r.post('/api/proveedores', {
        nit: ' 9876-5 ',
        nombre: 'Nuevo',
      });
      expect(creado.status).toBe(201);
      expect(creado.body).toMatchObject({ nit: '98765', contacto: null });

      expect(
        (await r.patch('/api/proveedores/1', { contacto: 'María' })).status,
      ).toBe(200);
      expect((await r.delete('/api/proveedores/1')).status).toBe(200);
      expect(
        (await r.patch('/api/proveedores/1', { activo: true })).status,
      ).toBe(200);
      expect(proveedores[0]).toMatchObject({ activo: true, contacto: 'María' });
    },
  );

  it('NIT duplicado: 409 "NIT ya registrado"', async () => {
    const res = await prueba
      .como(Rol.COMPRAS)
      .post('/api/proveedores', { nit: '1234567-8', nombre: 'Otro' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ message: 'NIT ya registrado' });
  });

  it.each(['CF', 'cf', ' C-F '])('NIT "%s": 400', async (nit) => {
    const res = await prueba
      .como(Rol.ADMIN)
      .post('/api/proveedores', { nit, nombre: 'X' });
    expect(res.status).toBe(400);
    expect((res.body as { message: string[] }).message).toEqual([
      'nit "CF" (consumidor final) no es válido aquí',
    ]);
  });

  it('GET /:id incluye productosActivos', async () => {
    const res = await prueba.como(Rol.BODEGUERO).get('/api/proveedores/1');
    expect(res.body).toMatchObject({ id: 1, productosActivos: 3 });
    expect(res.body).not.toHaveProperty('_count');
  });

  it('DELETE con productos activos: se permite y responde cuántos quedan', async () => {
    const res = await prueba.como(Rol.COMPRAS).delete('/api/proveedores/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      activo: false,
      productosActivos: 3,
    });
  });

  it('incluirInactivos: ADMIN y COMPRAS 200, BODEGUERO 403', async () => {
    const ruta = '/api/proveedores?incluirInactivos=true';
    expect((await prueba.como(Rol.ADMIN).get(ruta)).status).toBe(200);
    expect((await prueba.como(Rol.COMPRAS).get(ruta)).status).toBe(200);
    expect((await prueba.como(Rol.BODEGUERO).get(ruta)).status).toBe(403);
  });

  it('validaciones: body vacío, campo extra, nit null → 400; inexistente → 404', async () => {
    const r = prueba.como(Rol.ADMIN);
    expect((await r.patch('/api/proveedores/1', {})).status).toBe(400);
    expect(
      (await r.post('/api/proveedores', { nit: '5555', nombre: 'X', saldo: 1 }))
        .status,
    ).toBe(400);
    expect((await r.patch('/api/proveedores/1', { nit: null })).status).toBe(
      400,
    );
    expect((await r.get('/api/proveedores/99')).status).toBe(404);
    expect((await r.delete('/api/proveedores/99')).status).toBe(404);
  });
});
