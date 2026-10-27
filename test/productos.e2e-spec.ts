import { Prisma, Producto, Rol } from '../src/generated/prisma/client';
import { ProductosModule } from '../src/modules/productos/productos.module';
import { AppPrueba, crearAppPrueba } from './utils/app-prueba';

const REF_STOCK_MINIMO = Symbol('stockMinimo');

type Where = {
  id?: number;
  activo?: boolean;
  stock?: { gte?: number; lte?: typeof REF_STOCK_MINIMO };
};
type Args = {
  where?: Where;
  data?: Record<string, unknown>;
  omit?: { costo?: boolean };
};

function crearPrismaFalso(productos: Producto[]) {
  const coincide = (p: Producto, w: Where = {}) =>
    (w.id === undefined || p.id === w.id) &&
    (w.activo === undefined || p.activo === w.activo) &&
    (w.stock?.gte === undefined || p.stock >= w.stock.gte) &&
    (w.stock?.lte !== REF_STOCK_MINIMO || p.stock <= p.stockMinimo);
  const vista = (p: Producto, args: Args) => {
    const copia: Partial<Producto> = { ...p };
    if (args.omit?.costo) {
      delete copia.costo;
    }
    return copia;
  };
  const aplicar = (p: Producto, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const op = v as { increment?: number; decrement?: number };
      if (k === 'stock' && typeof v === 'object') {
        p.stock += (op.increment ?? 0) - (op.decrement ?? 0);
      } else {
        Object.assign(p, { [k]: v });
      }
    }
  };
  const noExiste = () =>
    Promise.reject(
      new Prisma.PrismaClientKnownRequestError('no existe', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

  return {
    proveedor: {
      // id 1 activo, id 2 inactivo
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve(where.id <= 2 ? { activo: where.id === 1 } : null),
    },
    producto: {
      fields: { stockMinimo: REF_STOCK_MINIMO },
      findMany: (args: Args) =>
        Promise.resolve(
          productos
            .filter((p) => coincide(p, args.where))
            .map((p) => vista(p, args)),
        ),
      count: (args: Args) =>
        Promise.resolve(
          productos.filter((p) => coincide(p, args.where)).length,
        ),
      findUnique: (args: Args) => {
        const p = productos.find((x) => x.id === args.where?.id);
        return Promise.resolve(p ? vista(p, args) : null);
      },
      create: (args: Args) => {
        const fecha = new Date();
        const nuevo = {
          ...args.data,
          id: productos.length + 1,
          stock: 0,
          activo: true,
          creadoEn: fecha,
          actualizadoEn: fecha,
        } as Producto;
        productos.push(nuevo);
        return Promise.resolve(vista(nuevo, args));
      },
      update: (args: Args) => {
        const p = productos.find((x) => x.id === args.where?.id);
        if (!p) return noExiste();
        aplicar(p, args.data ?? {});
        return Promise.resolve(vista(p, args));
      },
      updateManyAndReturn: (args: Args) => {
        const afectados = productos.filter((p) => coincide(p, args.where));
        afectados.forEach((p) => aplicar(p, args.data ?? {}));
        return Promise.resolve(afectados.map((p) => vista(p, args)));
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

describe('Productos (e2e)', () => {
  let prueba: AppPrueba;
  let productos: Producto[];

  beforeEach(async () => {
    const fecha = new Date('2026-10-01T00:00:00Z');
    const base = {
      descripcion: null,
      precioVenta: new Prisma.Decimal('100.00'),
      costo: new Prisma.Decimal('60.00'),
      proveedorId: 1,
      activo: true,
      creadoEn: fecha,
      actualizadoEn: fecha,
    };
    productos = [
      {
        ...base,
        id: 1,
        sku: 'A-1',
        nombre: 'Con stock',
        stock: 5,
        stockMinimo: 1,
      },
      {
        ...base,
        id: 2,
        sku: 'B-2',
        nombre: 'Stock bajo',
        stock: 2,
        stockMinimo: 5,
      },
    ];
    prueba = await crearAppPrueba(
      [ProductosModule],
      crearPrismaFalso(productos),
    );
  });

  afterEach(async () => {
    await prueba.app.close();
  });

  describe('costo según el rol', () => {
    it('VENDEDOR: sin costo; ADMIN: con costo (string)', async () => {
      const vend = await prueba.como(Rol.VENDEDOR).get('/api/productos/1');
      expect(vend.status).toBe(200);
      expect(vend.body).not.toHaveProperty('costo');
      expect(vend.body).toMatchObject({ precioVenta: '100', stock: 5 });

      const adm = await prueba.como(Rol.ADMIN).get('/api/productos/1');
      expect(adm.body).toMatchObject({ costo: '60' });
    });

    it('VENDEDOR: tampoco en el listado', async () => {
      const res = await prueba.como(Rol.VENDEDOR).get('/api/productos');
      const data = (res.body as { data: object[] }).data;
      expect(data).toHaveLength(2);
      for (const p of data) {
        expect(p).not.toHaveProperty('costo');
      }
    });
  });

  it('PATCH con `stock` en el body: 400 y el stock no cambia', async () => {
    const res = await prueba
      .como(Rol.ADMIN)
      .patch('/api/productos/1', { stock: 999 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(
      'property stock should not exist',
    );
    expect(productos[0].stock).toBe(5);
  });

  describe('ajuste-stock', () => {
    it('ajuste de -10 con stock 5: 409 y el stock sigue en 5', async () => {
      const res = await prueba
        .como(Rol.BODEGUERO)
        .post('/api/productos/1/ajuste-stock', {
          cantidad: -10,
          motivo: 'Merma total',
        });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ message: 'Stock insuficiente' });
      expect(productos[0].stock).toBe(5);
    });

    it('-5 con stock 5: 200 y queda en 0; +3: 200 y queda en 3', async () => {
      const r = prueba.como(Rol.BODEGUERO);
      const resta = await r.post('/api/productos/1/ajuste-stock', {
        cantidad: -5,
        motivo: 'Venta mostrador',
      });
      expect(resta.status).toBe(200);
      expect(resta.body).toMatchObject({ stock: 0 });

      const suma = await r.post('/api/productos/1/ajuste-stock', {
        cantidad: 3,
        motivo: 'Compra a proveedor',
      });
      expect(suma.body).toMatchObject({ stock: 3 });
    });

    it('cantidad 0 o motivo corto: 400; producto inexistente: 404', async () => {
      const r = prueba.como(Rol.ADMIN);
      expect(
        (
          await r.post('/api/productos/1/ajuste-stock', {
            cantidad: 0,
            motivo: 'Conteo',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await r.post('/api/productos/1/ajuste-stock', {
            cantidad: 1,
            motivo: 'ab',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await r.post('/api/productos/99/ajuste-stock', {
            cantidad: -1,
            motivo: 'Conteo',
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('stock-bajo', () => {
    it('lista el producto con stock 2 y mínimo 5 (y no el de stock 5 / mínimo 1)', async () => {
      const res = await prueba
        .como(Rol.COMPRAS)
        .get('/api/productos/stock-bajo');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1 });
      expect((res.body as { data: { id: number }[] }).data[0]).toMatchObject({
        id: 2,
        stock: 2,
        stockMinimo: 5,
      });
    });

    it('la ruta se resuelve antes que :id (no da 400 de ParseIntPipe)', async () => {
      const res = await prueba.como(Rol.ADMIN).get('/api/productos/stock-bajo');
      expect(res.status).toBe(200);
    });

    it('VENDEDOR: 403', async () => {
      expect(
        (await prueba.como(Rol.VENDEDOR).get('/api/productos/stock-bajo'))
          .status,
      ).toBe(403);
    });
  });

  describe('matriz de roles', () => {
    it.each(ROLES_TODOS())('%s puede listar y ver', async (rol) => {
      expect((await prueba.como(rol).get('/api/productos')).status).toBe(200);
      expect((await prueba.como(rol).get('/api/productos/1')).status).toBe(200);
    });

    it.each([Rol.VENDEDOR, Rol.COMPRAS])(
      '%s no puede crear, editar, borrar ni ajustar: 403',
      async (rol) => {
        const r = prueba.como(rol);
        const nuevo = { sku: 'X-1', nombre: 'X', precioVenta: '1', costo: '1' };
        expect((await r.post('/api/productos', nuevo)).status).toBe(403);
        expect(
          (await r.patch('/api/productos/1', { nombre: 'Y' })).status,
        ).toBe(403);
        expect((await r.delete('/api/productos/1')).status).toBe(403);
        expect(
          (
            await r.post('/api/productos/1/ajuste-stock', {
              cantidad: 1,
              motivo: 'Conteo',
            })
          ).status,
        ).toBe(403);
      },
    );

    it.each([Rol.ADMIN, Rol.BODEGUERO])(
      '%s crea, edita, borra y reactiva',
      async (rol) => {
        const r = prueba.como(rol);
        const creado = await r.post('/api/productos', {
          sku: ' nuevo-1 ',
          nombre: 'Nuevo',
          precioVenta: 10.5,
          costo: '7',
          proveedorId: 1,
        });
        expect(creado.status).toBe(201);
        expect(creado.body).toMatchObject({
          sku: 'NUEVO-1',
          stock: 0,
          precioVenta: '10.5',
        });

        expect(
          (await r.patch('/api/productos/1', { precioVenta: '120' })).status,
        ).toBe(200);
        expect((await r.delete('/api/productos/1')).status).toBe(200);
        expect(
          (await r.patch('/api/productos/1', { activo: true })).status,
        ).toBe(200);
        expect(productos[0].activo).toBe(true);
      },
    );
  });

  it('proveedor inactivo o inexistente: 400', async () => {
    const r = prueba.como(Rol.ADMIN);
    const base = { sku: 'P-1', nombre: 'P', precioVenta: '1', costo: '1' };
    expect(
      (await r.post('/api/productos', { ...base, proveedorId: 2 })).status,
    ).toBe(400);
    expect(
      (await r.post('/api/productos', { ...base, proveedorId: 50 })).status,
    ).toBe(400);
    expect((await r.patch('/api/productos/1', { proveedorId: 2 })).status).toBe(
      400,
    );
  });

  it('incluirInactivos: ADMIN y BODEGUERO 200; COMPRAS y VENDEDOR 403', async () => {
    const ruta = '/api/productos?incluirInactivos=true';
    expect((await prueba.como(Rol.ADMIN).get(ruta)).status).toBe(200);
    expect((await prueba.como(Rol.BODEGUERO).get(ruta)).status).toBe(200);
    expect((await prueba.como(Rol.COMPRAS).get(ruta)).status).toBe(403);
    expect((await prueba.como(Rol.VENDEDOR).get(ruta)).status).toBe(403);
  });
});

function ROLES_TODOS(): Rol[] {
  return [Rol.ADMIN, Rol.VENDEDOR, Rol.BODEGUERO, Rol.COMPRAS];
}
