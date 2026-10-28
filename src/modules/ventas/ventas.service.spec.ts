import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoVenta, Prisma, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { calcularTotales, VentasService } from './ventas.service';

function actor(rol: Rol, id = 7): UsuarioPublico {
  const fecha = new Date('2026-10-01T00:00:00Z');
  return {
    id,
    nombre: 'Actor',
    email: 'actor@empresa.com',
    rol,
    activo: true,
    creadoEn: fecha,
    actualizadoEn: fecha,
  };
}

function argumentos(mock: jest.Mock): unknown[] {
  return (mock.mock.calls as unknown[][]).map((llamada) => llamada[0]);
}

const dec = (valor: string) => new Prisma.Decimal(valor);

describe('calcularTotales', () => {
  it('3 × 19.99 = 59.97 exacto (con number sería 59.970000000000006)', () => {
    const { detalles, total } = calcularTotales([
      { productoId: 1, cantidad: 3, precioUnitario: dec('19.99') },
    ]);
    expect(detalles[0].subtotal.toFixed(2)).toBe('59.97');
    expect(total.toFixed(2)).toBe('59.97');
    expect(total.equals(dec('59.97'))).toBe(true);
  });

  it('total = suma exacta de subtotales', () => {
    const { detalles, total } = calcularTotales([
      { productoId: 1, cantidad: 3, precioUnitario: dec('0.10') },
      { productoId: 2, cantidad: 7, precioUnitario: dec('0.20') },
      { productoId: 3, cantidad: 1, precioUnitario: dec('1234.56') },
    ]);
    expect(detalles.map((d) => d.subtotal.toFixed(2))).toEqual([
      '0.30',
      '1.40',
      '1234.56',
    ]);
    expect(total.toFixed(2)).toBe('1236.26');
  });

  it('precio 0: subtotal 0', () => {
    expect(
      calcularTotales([
        { productoId: 1, cantidad: 5, precioUnitario: dec('0') },
      ]).total.toFixed(2),
    ).toBe('0.00');
  });

  it('total que no cabe en Decimal(12,2): 400', () => {
    expect(() =>
      calcularTotales([
        { productoId: 1, cantidad: 2, precioUnitario: dec('5000000000.00') },
      ]),
    ).toThrow(BadRequestException);
    // Justo el máximo sí cabe
    expect(
      calcularTotales([
        { productoId: 1, cantidad: 1, precioUnitario: dec('9999999999.99') },
      ]).total.toFixed(2),
    ).toBe('9999999999.99');
  });
});

describe('VentasService', () => {
  const admin = actor(Rol.ADMIN, 1);
  const vendedor = actor(Rol.VENDEDOR, 2);

  let tx: {
    producto: Record<
      'updateManyAndReturn' | 'findUnique' | 'update',
      jest.Mock
    >;
    venta: Record<'create' | 'updateMany' | 'findUniqueOrThrow', jest.Mock>;
    detalleVenta: { findMany: jest.Mock };
  };
  let prisma: {
    venta: Record<'findMany' | 'count' | 'findFirst', jest.Mock>;
    $transaction: jest.Mock;
  };
  let clientes: { estaActivo: jest.Mock };
  let servicio: VentasService;

  beforeEach(() => {
    tx = {
      producto: {
        // Por defecto: hay stock y el precio es 19.99
        updateManyAndReturn: jest
          .fn()
          .mockResolvedValue([{ precioVenta: dec('19.99') }]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      venta: {
        create: jest.fn((args: unknown) => Promise.resolve(args)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 5 }),
      },
      detalleVenta: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma = {
      venta: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
      // Arreglo de operaciones (listar) o función interactiva (crear, anular)
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    clientes = { estaActivo: jest.fn().mockResolvedValue(true) };
    servicio = new VentasService(
      prisma as unknown as PrismaService,
      clientes as unknown as ClientesService,
    );
  });

  describe('crear', () => {
    const dto = {
      clienteId: 4,
      items: [
        { productoId: 9, cantidad: 1 },
        { productoId: 2, cantidad: 3 },
        { productoId: 5, cantidad: 2 },
      ],
    };

    it('cliente inexistente o inactivo: 400 y no abre la transacción', async () => {
      clientes.estaActivo.mockResolvedValue(false);
      await expect(servicio.crear(dto, vendedor)).rejects.toThrow(
        BadRequestException,
      );
      expect(clientes.estaActivo).toHaveBeenCalledWith(4);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('descuenta en orden ascendente de productoId, condicionado a activo y stock', async () => {
      await servicio.crear(dto, vendedor);
      expect(argumentos(tx.producto.updateManyAndReturn)[0]).toEqual({
        where: { id: 2, activo: true, stock: { gte: 3 } },
        data: { stock: { decrement: 3 } },
        select: { precioVenta: true },
      });
      expect(
        argumentos(tx.producto.updateManyAndReturn).map(
          (a) => (a as { where: { id: number } }).where.id,
        ),
      ).toEqual([2, 5, 9]);
      // No reordena el DTO recibido
      expect(dto.items.map((i) => i.productoId)).toEqual([9, 2, 5]);
    });

    it('vendedor del token, precio de la base y total con Decimal', async () => {
      tx.producto.updateManyAndReturn
        .mockResolvedValueOnce([{ precioVenta: dec('19.99') }]) // id 2 × 3
        .mockResolvedValueOnce([{ precioVenta: dec('0.10') }]) // id 5 × 2
        .mockResolvedValueOnce([{ precioVenta: dec('100.00') }]); // id 9 × 1
      await servicio.crear(dto, vendedor);

      const { data } = argumentos(tx.venta.create)[0] as {
        data: {
          usuarioId: number;
          clienteId: number;
          total: Prisma.Decimal;
          detalles: {
            create: {
              productoId: number;
              precioUnitario: Prisma.Decimal;
              subtotal: Prisma.Decimal;
            }[];
          };
        };
      };
      expect(data.usuarioId).toBe(vendedor.id);
      expect(data.clienteId).toBe(4);
      expect(data.total.toFixed(2)).toBe('160.17');
      expect(
        data.detalles.create.map((d) => [
          d.productoId,
          d.precioUnitario.toFixed(2),
          d.subtotal.toFixed(2),
        ]),
      ).toEqual([
        [2, '19.99', '59.97'],
        [5, '0.10', '0.20'],
        [9, '100.00', '100.00'],
      ]);
    });

    it('un producto sin stock: 409 con el detalle y no crea la venta', async () => {
      tx.producto.updateManyAndReturn
        .mockResolvedValueOnce([{ precioVenta: dec('1.00') }])
        .mockResolvedValueOnce([]);
      tx.producto.findUnique.mockResolvedValue({
        sku: 'B-5',
        activo: true,
        stock: 1,
      });

      const error = servicio.crear(dto, vendedor);
      await expect(error).rejects.toThrow(ConflictException);
      await expect(error).rejects.toThrow(
        'Stock insuficiente para B-5 (id 5): disponible 1, solicitado 2',
      );
      // Se detiene en el que falla; la base revierte el descuento del primero
      expect(tx.producto.updateManyAndReturn).toHaveBeenCalledTimes(2);
      expect(tx.venta.create).not.toHaveBeenCalled();
    });

    it.each([
      [null, 'El producto 2 no existe'],
      [{ sku: 'A-2', activo: false, stock: 50 }, 'está inactivo'],
    ])('producto %p: 409 "%s"', async (producto, mensaje) => {
      tx.producto.updateManyAndReturn.mockResolvedValueOnce([]);
      tx.producto.findUnique.mockResolvedValue(producto);
      await expect(servicio.crear(dto, vendedor)).rejects.toThrow(mensaje);
    });
  });

  describe('listar', () => {
    const base = { page: 2, limit: 10 };

    it('VENDEDOR: solo sus ventas; ADMIN: todas', async () => {
      await servicio.listar(base, vendedor);
      await servicio.listar(base, admin);
      const [deVendedor, deAdmin] = argumentos(prisma.venta.findMany);
      expect(deVendedor).toMatchObject({
        where: { usuarioId: vendedor.id },
        skip: 10,
        take: 10,
      });
      expect(deAdmin).toMatchObject({ where: {} });
      expect(argumentos(prisma.venta.count)[0]).toEqual({
        where: { usuarioId: vendedor.id },
      });
    });

    it('aplica fechas, cliente y estado', async () => {
      const desde = new Date('2026-10-01T06:00:00Z');
      const hasta = new Date('2026-11-01T05:59:59.999Z');
      await servicio.listar(
        { ...base, desde, hasta, clienteId: 3, estado: EstadoVenta.ANULADA },
        admin,
      );
      expect(argumentos(prisma.venta.findMany)[0]).toMatchObject({
        where: {
          clienteId: 3,
          estado: EstadoVenta.ANULADA,
          fecha: { gte: desde, lte: hasta },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      });
    });

    it('solo desde: sin límite superior', async () => {
      const desde = new Date('2026-10-01T06:00:00Z');
      await servicio.listar({ ...base, desde }, admin);
      expect(argumentos(prisma.venta.findMany)[0]).toMatchObject({
        where: { fecha: { gte: desde, lte: undefined } },
      });
    });

    it('desde posterior a hasta: 400', async () => {
      await expect(
        servicio.listar(
          {
            ...base,
            desde: new Date('2026-10-02T00:00:00Z'),
            hasta: new Date('2026-10-01T00:00:00Z'),
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('obtener', () => {
    it('VENDEDOR: la consulta exige que la venta sea suya; ajena → 404', async () => {
      prisma.venta.findFirst.mockResolvedValue(null);
      await expect(servicio.obtener(8, vendedor)).rejects.toThrow(
        NotFoundException,
      );
      expect(argumentos(prisma.venta.findFirst)[0]).toMatchObject({
        where: { id: 8, usuarioId: vendedor.id },
      });
    });

    it('ADMIN: cualquier venta', async () => {
      prisma.venta.findFirst.mockResolvedValue({ id: 8 });
      await expect(servicio.obtener(8, admin)).resolves.toEqual({ id: 8 });
      expect(argumentos(prisma.venta.findFirst)[0]).toMatchObject({
        where: { id: 8 },
      });
    });
  });

  describe('anular', () => {
    const dto = { motivo: 'Cliente devolvió la mercadería' };

    it('solo cambia ventas COMPLETADA y devuelve el stock de cada detalle', async () => {
      tx.detalleVenta.findMany.mockResolvedValue([
        { productoId: 2, cantidad: 3 },
        { productoId: 9, cantidad: 1 },
      ]);
      await servicio.anular(5, dto);

      expect(argumentos(tx.venta.updateMany)[0]).toEqual({
        where: { id: 5, estado: EstadoVenta.COMPLETADA },
        data: {
          estado: EstadoVenta.ANULADA,
          anuladaEn: expect.any(Date) as Date,
          motivoAnulacion: dto.motivo,
        },
      });
      expect(argumentos(tx.producto.update)).toEqual([
        { where: { id: 2 }, data: { stock: { increment: 3 } } },
        { where: { id: 9 }, data: { stock: { increment: 1 } } },
      ]);
    });

    it('ya anulada o inexistente: 409 y NO devuelve stock', async () => {
      tx.venta.updateMany.mockResolvedValue({ count: 0 });
      await expect(servicio.anular(5, dto)).rejects.toThrow(
        'La venta no existe o ya fue anulada',
      );
      expect(tx.detalleVenta.findMany).not.toHaveBeenCalled();
      expect(tx.producto.update).not.toHaveBeenCalled();
    });
  });
});
