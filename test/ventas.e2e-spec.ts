import { EstadoVenta, Prisma, Rol } from '../src/generated/prisma/client';
import { VentasModule } from '../src/modules/ventas/ventas.module';
import { AppPrueba, crearAppPrueba, ROLES } from './utils/app-prueba';

interface ProductoFalso {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: Prisma.Decimal;
  stock: number;
  activo: boolean;
}
interface DetalleFalso {
  id: number;
  ventaId: number;
  productoId: number;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}
interface VentaFalsa {
  id: number;
  clienteId: number;
  usuarioId: number;
  fecha: Date;
  total: Prisma.Decimal;
  estado: EstadoVenta;
  anuladaEn: Date | null;
  motivoAnulacion: string | null;
}
type WhereVenta = Partial<Pick<VentaFalsa, 'id' | 'usuarioId' | 'estado'>>;

// Prisma en memoria. $transaction interactiva: si la función lanza, se
// restaura lo que había antes (como el ROLLBACK de la base).
function crearPrismaFalso(productos: ProductoFalso[]) {
  const ventas: VentaFalsa[] = [];
  const detalles: DetalleFalso[] = [];
  const clientes = [
    { id: 1, nit: 'CF', nombre: 'Juan Pérez', activo: true },
    { id: 2, nit: '1234567', nombre: 'Inactivo S.A.', activo: false },
  ];

  const coincide = (v: VentaFalsa, w: WhereVenta = {}) =>
    (w.id === undefined || v.id === w.id) &&
    (w.usuarioId === undefined || v.usuarioId === w.usuarioId) &&
    (w.estado === undefined || v.estado === w.estado);

  // Lo que devuelve el include de la venta (resumen + detalles)
  const conRelaciones = (v: VentaFalsa) => {
    const rol = ROLES[v.usuarioId - 1];
    const cliente = clientes.find((c) => c.id === v.clienteId)!;
    return {
      ...v,
      cliente: { id: cliente.id, nit: cliente.nit, nombre: cliente.nombre },
      usuario: {
        id: v.usuarioId,
        nombre: rol,
        email: `${rol.toLowerCase()}@empresa.com`,
      },
      detalles: detalles
        .filter((d) => d.ventaId === v.id)
        .map((d) => {
          const p = productos.find((x) => x.id === d.productoId)!;
          return { ...d, producto: { id: p.id, sku: p.sku, nombre: p.nombre } };
        }),
    };
  };

  const prisma = {
    cliente: {
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve(clientes.find((c) => c.id === where.id) ?? null),
    },
    producto: {
      updateManyAndReturn: ({
        where,
        data,
      }: {
        where: { id: number; activo: boolean; stock: { gte: number } };
        data: { stock: { decrement: number } };
      }) => {
        const p = productos.find(
          (x) =>
            x.id === where.id &&
            x.activo === where.activo &&
            x.stock >= where.stock.gte,
        );
        if (!p) return Promise.resolve([]);
        p.stock -= data.stock.decrement;
        return Promise.resolve([{ precioVenta: p.precioVenta }]);
      },
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve(productos.find((x) => x.id === where.id) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: number };
        data: { stock: { increment: number } };
      }) => {
        const p = productos.find((x) => x.id === where.id)!;
        p.stock += data.stock.increment;
        return Promise.resolve(p);
      },
    },
    venta: {
      create: ({
        data,
      }: {
        data: Omit<
          VentaFalsa,
          'id' | 'fecha' | 'estado' | 'anuladaEn' | 'motivoAnulacion'
        > & {
          detalles: { create: Omit<DetalleFalso, 'id' | 'ventaId'>[] };
        };
      }) => {
        const venta: VentaFalsa = {
          id: ventas.length + 1,
          clienteId: data.clienteId,
          usuarioId: data.usuarioId,
          fecha: new Date(),
          total: data.total,
          estado: EstadoVenta.COMPLETADA,
          anuladaEn: null,
          motivoAnulacion: null,
        };
        ventas.push(venta);
        for (const d of data.detalles.create) {
          detalles.push({ ...d, id: detalles.length + 1, ventaId: venta.id });
        }
        return Promise.resolve(conRelaciones(venta));
      },
      findMany: ({ where }: { where: WhereVenta }) =>
        Promise.resolve(
          ventas.filter((v) => coincide(v, where)).map(conRelaciones),
        ),
      count: ({ where }: { where: WhereVenta }) =>
        Promise.resolve(ventas.filter((v) => coincide(v, where)).length),
      findFirst: ({ where }: { where: WhereVenta }) => {
        const v = ventas.find((x) => coincide(x, where));
        return Promise.resolve(v ? conRelaciones(v) : null);
      },
      findUniqueOrThrow: ({ where }: { where: { id: number } }) =>
        Promise.resolve(conRelaciones(ventas.find((x) => x.id === where.id)!)),
      updateMany: ({
        where,
        data,
      }: {
        where: WhereVenta;
        data: Partial<VentaFalsa>;
      }) => {
        const afectadas = ventas.filter((v) => coincide(v, where));
        afectadas.forEach((v) => Object.assign(v, data));
        return Promise.resolve({ count: afectadas.length });
      },
    },
    detalleVenta: {
      findMany: ({ where }: { where: { ventaId: number } }) =>
        Promise.resolve(detalles.filter((d) => d.ventaId === where.ventaId)),
    },
    $transaction: async (arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      const stock = productos.map((p) => p.stock);
      const [nVentas, nDetalles] = [ventas.length, detalles.length];
      const estados = ventas.map((v) => ({ ...v }));
      try {
        return await (arg as (tx: unknown) => Promise<unknown>)(prisma);
      } catch (e) {
        productos.forEach((p, i) => (p.stock = stock[i]));
        ventas.splice(nVentas);
        detalles.splice(nDetalles);
        estados.forEach((v, i) => Object.assign(ventas[i], v));
        throw e;
      }
    },
  };
  return prisma;
}

describe('Ventas (e2e)', () => {
  let prueba: AppPrueba;
  let productos: ProductoFalso[];
  const stock = () => productos.map((p) => p.stock);

  beforeEach(async () => {
    const base = { activo: true, precioVenta: new Prisma.Decimal('19.99') };
    productos = [
      { ...base, id: 1, sku: 'A-1', nombre: 'Uno', stock: 10 },
      {
        ...base,
        id: 2,
        sku: 'B-2',
        nombre: 'Dos',
        stock: 5,
        precioVenta: new Prisma.Decimal('0.10'),
      },
      { ...base, id: 3, sku: 'C-3', nombre: 'Tres', stock: 1 },
      {
        ...base,
        id: 4,
        sku: 'D-4',
        nombre: 'Inactivo',
        stock: 9,
        activo: false,
      },
    ];
    prueba = await crearAppPrueba([VentasModule], crearPrismaFalso(productos));
  });

  afterEach(async () => {
    await prueba.app.close();
  });

  const vender = (rol: Rol, items: object[], clienteId = 1) =>
    prueba.como(rol).post('/api/ventas', { clienteId, items });

  it('venta correcta: 201, stock descontado, total = suma de subtotales', async () => {
    const res = await vender(Rol.VENDEDOR, [
      { productoId: 2, cantidad: 3 },
      { productoId: 1, cantidad: 3 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      total: '60.27',
      estado: 'COMPLETADA',
      usuarioId: 2, // VENDEDOR del token
      cliente: { id: 1, nit: 'CF' },
      usuario: { id: 2, email: 'vendedor@empresa.com' },
      // Ordenados por productoId
      detalles: [
        {
          productoId: 1,
          precioUnitario: '19.99',
          subtotal: '59.97',
          producto: { sku: 'A-1', nombre: 'Uno' },
        },
        { productoId: 2, precioUnitario: '0.1', subtotal: '0.3' },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(stock()).toEqual([7, 2, 1, 9]);
  });

  it('3 items y uno sin stock suficiente: 409 y NINGÚN stock cambia', async () => {
    const res = await vender(Rol.VENDEDOR, [
      { productoId: 1, cantidad: 2 },
      { productoId: 2, cantidad: 1 },
      { productoId: 3, cantidad: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      message: 'Stock insuficiente para C-3 (id 3): disponible 1, solicitado 2',
    });
    expect(stock()).toEqual([10, 5, 1, 9]);
  });

  it('producto inactivo: 409', async () => {
    const res = await vender(Rol.ADMIN, [{ productoId: 4, cantidad: 1 }]);
    expect(res.status).toBe(409);
    expect(stock()[3]).toBe(9);
  });

  it.each([
    [
      'precioUnitario en un item',
      [{ productoId: 1, cantidad: 1, precioUnitario: '0.01' }],
      'property precioUnitario should not exist',
    ],
    [
      'productoId repetido',
      [
        { productoId: 1, cantidad: 1 },
        { productoId: 1, cantidad: 2 },
      ],
      'items no puede repetir productoId',
    ],
  ])('%s: 400 y el stock no cambia', async (_caso, items, mensaje) => {
    const res = await vender(Rol.VENDEDOR, items);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(mensaje);
    expect(stock()).toEqual([10, 5, 1, 9]);
  });

  it('usuarioId en el body: 400 (sale del token)', async () => {
    const res = await prueba.como(Rol.VENDEDOR).post('/api/ventas', {
      clienteId: 1,
      usuarioId: 1,
      items: [{ productoId: 1, cantidad: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('cliente inactivo: 400', async () => {
    const res = await vender(Rol.VENDEDOR, [{ productoId: 1, cantidad: 1 }], 2);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      message: 'clienteId debe ser un cliente activo',
    });
  });

  it('roles: BODEGUERO y COMPRAS no venden ni consultan', async () => {
    for (const rol of [Rol.BODEGUERO, Rol.COMPRAS]) {
      expect((await vender(rol, [{ productoId: 1, cantidad: 1 }])).status).toBe(
        403,
      );
      expect((await prueba.como(rol).get('/api/ventas')).status).toBe(403);
    }
    expect((await prueba.sinToken().get('/api/ventas')).status).toBe(401);
  });

  describe('consultar', () => {
    beforeEach(async () => {
      await vender(Rol.ADMIN, [{ productoId: 1, cantidad: 1 }]); // venta 1
      await vender(Rol.VENDEDOR, [{ productoId: 2, cantidad: 1 }]); // venta 2
    });

    it('VENDEDOR pidiendo venta de otro vendedor: 404; la suya: 200', async () => {
      const vend = prueba.como(Rol.VENDEDOR);
      expect((await vend.get('/api/ventas/1')).status).toBe(404);
      const propia = await vend.get('/api/ventas/2');
      expect(propia.status).toBe(200);
      expect(propia.body).toMatchObject({
        id: 2,
        detalles: [{ producto: { sku: 'B-2' } }],
      });
    });

    it('listado: VENDEDOR ve solo las suyas, ADMIN todas', async () => {
      const vend = await prueba.como(Rol.VENDEDOR).get('/api/ventas');
      expect(vend.body).toMatchObject({ total: 1, page: 1, limit: 20 });
      const adm = await prueba.como(Rol.ADMIN).get('/api/ventas');
      expect(adm.body).toMatchObject({ total: 2 });
    });

    it('filtros inválidos: 400', async () => {
      const adm = prueba.como(Rol.ADMIN);
      expect(
        (await adm.get('/api/ventas?desde=2026-10-31&hasta=2026-10-01')).status,
      ).toBe(400);
      expect((await adm.get('/api/ventas?estado=PENDIENTE')).status).toBe(400);
    });
  });

  describe('anular', () => {
    const motivo = { motivo: 'Cliente devolvió la mercadería' };

    beforeEach(async () => {
      await vender(Rol.VENDEDOR, [
        { productoId: 1, cantidad: 4 },
        { productoId: 2, cantidad: 2 },
      ]);
      expect(stock()).toEqual([6, 3, 1, 9]);
    });

    it('dos veces la misma venta: la segunda 409 y el stock se devolvió una sola vez', async () => {
      const adm = prueba.como(Rol.ADMIN);
      const primera = await adm.post('/api/ventas/1/anular', motivo);
      expect(primera.status).toBe(200);
      expect(primera.body).toMatchObject({
        estado: 'ANULADA',
        motivoAnulacion: motivo.motivo,
      });
      expect(primera.body).toHaveProperty('anuladaEn');
      expect(stock()).toEqual([10, 5, 1, 9]);

      const segunda = await adm.post('/api/ventas/1/anular', motivo);
      expect(segunda.status).toBe(409);
      expect(segunda.body).toMatchObject({
        message: 'La venta no existe o ya fue anulada',
      });
      expect(stock()).toEqual([10, 5, 1, 9]);
    });

    it('venta inexistente: 409', async () => {
      const res = await prueba
        .como(Rol.ADMIN)
        .post('/api/ventas/99/anular', motivo);
      expect(res.status).toBe(409);
    });

    it('VENDEDOR no puede anular; motivo corto: 400', async () => {
      expect(
        (await prueba.como(Rol.VENDEDOR).post('/api/ventas/1/anular', motivo))
          .status,
      ).toBe(403);
      expect(
        (
          await prueba
            .como(Rol.ADMIN)
            .post('/api/ventas/1/anular', { motivo: 'no' })
        ).status,
      ).toBe(400);
      expect(stock()).toEqual([6, 3, 1, 9]);
    });
  });
});
