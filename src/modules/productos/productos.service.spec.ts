import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ProductosService } from './productos.service';

function actor(rol: Rol): UsuarioPublico {
  const fecha = new Date('2026-10-01T00:00:00Z');
  return {
    id: 7,
    nombre: 'Actor',
    email: 'actor@empresa.com',
    rol,
    activo: true,
    creadoEn: fecha,
    actualizadoEn: fecha,
  };
}

function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

const REF_STOCK_MINIMO = { nombre: 'referencia a stockMinimo' };

describe('ProductosService', () => {
  const admin = actor(Rol.ADMIN);
  const bodeguero = actor(Rol.BODEGUERO);
  const vendedor = actor(Rol.VENDEDOR);

  let prisma: {
    producto: Record<
      | 'findMany'
      | 'count'
      | 'findUnique'
      | 'create'
      | 'update'
      | 'updateManyAndReturn',
      jest.Mock
    > & { fields: { stockMinimo: unknown } };
    $transaction: jest.Mock;
  };
  let proveedores: { estaActivo: jest.Mock };
  let servicio: ProductosService;
  let log: jest.SpyInstance;

  beforeEach(() => {
    prisma = {
      producto: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateManyAndReturn: jest.fn(),
        fields: { stockMinimo: REF_STOCK_MINIMO },
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    proveedores = { estaActivo: jest.fn().mockResolvedValue(true) };
    servicio = new ProductosService(
      prisma as unknown as PrismaService,
      proveedores as unknown as ProveedoresService,
    );
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  describe('costo según el rol', () => {
    const base = { page: 1, limit: 20, incluirInactivos: false };

    it('VENDEDOR: la consulta omite costo (no sale de la base)', async () => {
      await servicio.listar(base, vendedor);
      expect(primerArgumento(prisma.producto.findMany)).toMatchObject({
        omit: { costo: true },
      });
    });

    it.each([Rol.ADMIN, Rol.BODEGUERO, Rol.COMPRAS])(
      '%s: la consulta incluye costo',
      async (rol) => {
        await servicio.listar(base, actor(rol));
        expect(primerArgumento(prisma.producto.findMany)).toMatchObject({
          omit: {},
        });
      },
    );

    it('también se omite en obtener, stock-bajo y ajuste', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 1,
        sku: 'A',
        stock: 1,
      });
      prisma.producto.update.mockResolvedValue({ id: 1, sku: 'A', stock: 6 });
      await servicio.obtener(1, vendedor);
      await servicio.stockBajo({ page: 1, limit: 20 }, vendedor);
      await servicio.ajustarStock(
        1,
        { cantidad: 5, motivo: 'compra' },
        vendedor,
      );

      for (const mock of [
        prisma.producto.findUnique,
        prisma.producto.findMany,
        prisma.producto.update,
      ]) {
        expect(primerArgumento(mock)).toMatchObject({ omit: { costo: true } });
      }
    });
  });

  describe('listar', () => {
    const base = { page: 1, limit: 20, incluirInactivos: false };

    it('filtra por proveedor y busca por nombre o SKU (normalizado y escapado)', async () => {
      await servicio.listar(
        { ...base, proveedorId: 3, buscar: 'lap_1' },
        admin,
      );
      expect(primerArgumento(prisma.producto.findMany)).toMatchObject({
        where: {
          activo: true,
          proveedorId: 3,
          OR: [
            { nombre: { contains: 'lap\\_1', mode: 'insensitive' } },
            { sku: { contains: 'LAP\\_1' } },
          ],
        },
      });
    });

    it.each([Rol.ADMIN, Rol.BODEGUERO])(
      '%s puede usar incluirInactivos',
      async (rol) => {
        await servicio.listar({ ...base, incluirInactivos: true }, actor(rol));
        expect(prisma.producto.count).toHaveBeenCalledWith({ where: {} });
      },
    );

    it.each([Rol.COMPRAS, Rol.VENDEDOR])(
      '%s con incluirInactivos: 403',
      async (rol) => {
        await expect(
          servicio.listar({ ...base, incluirInactivos: true }, actor(rol)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });

  describe('stockBajo', () => {
    it('activos con stock <= stockMinimo, usando la referencia de campo', async () => {
      await servicio.stockBajo({ page: 1, limit: 20 }, bodeguero);
      const { where } = primerArgumento(prisma.producto.findMany) as {
        where: { activo: boolean; stock: { lte: unknown } };
      };
      expect(where.activo).toBe(true);
      expect(where.stock.lte).toBe(REF_STOCK_MINIMO);
    });
  });

  describe('crear', () => {
    const dto = {
      sku: 'LAP-001',
      nombre: 'Laptop',
      precioVenta: '5999.99',
      costo: '4500',
      proveedorId: 2,
    };

    it('convierte el dinero a Decimal y el stock no se envía (nace en 0)', async () => {
      await servicio.crear(dto, admin);
      const { data } = primerArgumento(prisma.producto.create) as {
        data: Record<string, unknown>;
      };
      expect(data.precioVenta).toBeInstanceOf(Prisma.Decimal);
      expect(String(data.precioVenta)).toBe('5999.99');
      expect(data).not.toHaveProperty('stock');
      expect(data).toMatchObject({ stockMinimo: 0, proveedorId: 2 });
    });

    it('400 si el proveedor no está activo (o no existe)', async () => {
      proveedores.estaActivo.mockResolvedValue(false);
      await expect(servicio.crear(dto, admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    it('sin proveedor (null) no consulta proveedores', async () => {
      await servicio.crear({ ...dto, proveedorId: null }, admin);
      expect(proveedores.estaActivo).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('400 con body vacío', async () => {
      await expect(servicio.actualizar(1, {}, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('valida el proveedor nuevo y nunca envía stock', async () => {
      prisma.producto.update.mockResolvedValue({});
      await servicio.actualizar(
        1,
        { proveedorId: 4, precioVenta: '10' },
        admin,
      );
      expect(proveedores.estaActivo).toHaveBeenCalledWith(4);
      const { data } = primerArgumento(prisma.producto.update) as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('stock');
      expect(data.precioVenta).toBeInstanceOf(Prisma.Decimal);
      expect(data.costo).toBeUndefined();
    });

    it('400 si el proveedor nuevo está inactivo', async () => {
      proveedores.estaActivo.mockResolvedValue(false);
      await expect(
        servicio.actualizar(1, { proveedorId: 4 }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.producto.update).not.toHaveBeenCalled();
    });
  });

  describe('ajustarStock', () => {
    it('positivo: update con increment (atómico)', async () => {
      prisma.producto.update.mockResolvedValue({ id: 1, sku: 'A', stock: 8 });
      const r = await servicio.ajustarStock(
        1,
        { cantidad: 3, motivo: 'Compra' },
        bodeguero,
      );
      expect(primerArgumento(prisma.producto.update)).toMatchObject({
        where: { id: 1 },
        data: { stock: { increment: 3 } },
      });
      expect(r.stock).toBe(8);
    });

    it('negativo: UPDATE condicionado a stock >= cantidad con decrement y RETURNING', async () => {
      prisma.producto.updateManyAndReturn.mockResolvedValue([
        { id: 1, sku: 'A', stock: 0 },
      ]);
      const r = await servicio.ajustarStock(
        1,
        { cantidad: -5, motivo: 'Merma' },
        bodeguero,
      );
      expect(prisma.producto.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: 1, stock: { gte: 5 } },
        data: { stock: { decrement: 5 } },
        omit: {},
      });
      // El stock de la respuesta sale del propio UPDATE, sin lectura aparte
      expect(r.stock).toBe(0);
      expect(prisma.producto.findUnique).not.toHaveBeenCalled();
    });

    it('negativo con stock insuficiente (0 filas): 409 "Stock insuficiente"', async () => {
      prisma.producto.updateManyAndReturn.mockResolvedValue([]);
      prisma.producto.findUnique.mockResolvedValue({ id: 1, stock: 5 });
      const error = servicio.ajustarStock(
        1,
        { cantidad: -10, motivo: 'Merma' },
        bodeguero,
      );
      await expect(error).rejects.toBeInstanceOf(ConflictException);
      await expect(error).rejects.toThrow('Stock insuficiente');
      expect(log).not.toHaveBeenCalled();
    });

    it('negativo sobre producto inexistente: 404 (no 409)', async () => {
      prisma.producto.updateManyAndReturn.mockResolvedValue([]);
      prisma.producto.findUnique.mockResolvedValue(null);
      await expect(
        servicio.ajustarStock(99, { cantidad: -1, motivo: 'Merma' }, bodeguero),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('escribe en el log usuario, cantidad, stock final y motivo (sin saltos de línea)', async () => {
      prisma.producto.update.mockResolvedValue({
        id: 1,
        sku: 'LAP-1',
        stock: 8,
      });
      await servicio.ajustarStock(
        1,
        { cantidad: 3, motivo: 'Compra\nFALSO: línea inyectada' },
        bodeguero,
      );
      const mensaje = (log.mock.calls as unknown[][])[0][0] as string;
      expect(mensaje).toContain('producto 1 (LAP-1) +3 → stock 8');
      expect(mensaje).toContain('usuario 7 <actor@empresa.com>');
      expect(mensaje).toContain('"Compra\\nFALSO: línea inyectada"');
      expect(mensaje).not.toContain('\n');
    });
  });

  describe('desactivar', () => {
    it('borrado lógico', async () => {
      await servicio.desactivar(3, admin);
      expect(primerArgumento(prisma.producto.update)).toMatchObject({
        where: { id: 3 },
        data: { activo: false },
      });
    });
  });
});
