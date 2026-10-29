import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ProveedoresService } from './proveedores.service';

function actor(rol: Rol): UsuarioPublico {
  const fecha = new Date('2026-10-01T00:00:00Z');
  return {
    id: 1,
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

const CONTEO = {
  _count: { select: { productos: { where: { activo: true } } } },
};

describe('ProveedoresService', () => {
  let prisma: {
    proveedor: Record<
      'findMany' | 'count' | 'findUnique' | 'create' | 'update',
      jest.Mock
    >;
    $transaction: jest.Mock;
  };
  let servicio: ProveedoresService;

  beforeEach(() => {
    prisma = {
      proveedor: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    servicio = new ProveedoresService(prisma as unknown as PrismaService);
  });

  describe('listar', () => {
    const base = { page: 1, limit: 20, incluirInactivos: false };

    it('por defecto solo activos', async () => {
      await servicio.listar(base, actor(Rol.BODEGUERO));
      expect(prisma.proveedor.count).toHaveBeenCalledWith({
        where: { activo: true },
      });
    });

    it('buscar por nombre o NIT normalizado, con comodines escapados', async () => {
      await servicio.listar({ ...base, buscar: '50%-1' }, actor(Rol.COMPRAS));
      const { where } = primerArgumento(prisma.proveedor.findMany) as {
        where: unknown;
      };
      expect(where).toEqual({
        activo: true,
        OR: [
          { nombre: { contains: '50\\%-1', mode: 'insensitive' } },
          { nit: { contains: '50\\%1' } },
        ],
      });
    });

    it.each([Rol.ADMIN, Rol.COMPRAS])(
      '%s puede usar incluirInactivos',
      async (rol) => {
        await servicio.listar({ ...base, incluirInactivos: true }, actor(rol));
        expect(prisma.proveedor.count).toHaveBeenCalledWith({ where: {} });
      },
    );

    it('cada fila trae productosActivos (mismo include que el detalle)', async () => {
      prisma.proveedor.findMany.mockResolvedValue([
        { id: 2, nombre: 'P', _count: { productos: 4 } },
      ]);
      prisma.proveedor.count.mockResolvedValue(1);

      const r = await servicio.listar(base, actor(Rol.COMPRAS));

      expect(primerArgumento(prisma.proveedor.findMany)).toMatchObject({
        include: CONTEO,
      });
      expect(r.data).toEqual([{ id: 2, nombre: 'P', productosActivos: 4 }]);
    });

    it('BODEGUERO con incluirInactivos: 403', async () => {
      await expect(
        servicio.listar(
          { ...base, incluirInactivos: true },
          actor(Rol.BODEGUERO),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.proveedor.findMany).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('incluye el conteo de productos ACTIVOS como productosActivos', async () => {
      prisma.proveedor.findUnique.mockResolvedValue({
        id: 2,
        nombre: 'P',
        _count: { productos: 3 },
      });

      const r = await servicio.obtener(2);

      expect(prisma.proveedor.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        include: CONTEO,
      });
      expect(r).toEqual({ id: 2, nombre: 'P', productosActivos: 3 });
      expect(r).not.toHaveProperty('_count');
    });

    it('404 si no existe', async () => {
      prisma.proveedor.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('guarda los opcionales ausentes como null', async () => {
      await servicio.crear({ nit: '12345678', nombre: 'Distribuidora' });
      expect(prisma.proveedor.create).toHaveBeenCalledWith({
        data: {
          nit: '12345678',
          nombre: 'Distribuidora',
          contacto: null,
          telefono: null,
          email: null,
          direccion: null,
        },
      });
    });
  });

  describe('actualizar', () => {
    it('400 con body vacío', async () => {
      await expect(servicio.actualizar(1, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.proveedor.update).not.toHaveBeenCalled();
    });

    it('reactiva con activo=true y borra campos con null', async () => {
      await servicio.actualizar(1, { activo: true, contacto: null });
      expect(primerArgumento(prisma.proveedor.update)).toMatchObject({
        where: { id: 1 },
        data: { activo: true, contacto: null, nit: undefined },
      });
    });
  });

  describe('desactivar', () => {
    it('se permite aunque tenga productos activos y devuelve cuántos quedan', async () => {
      prisma.proveedor.update.mockResolvedValue({
        id: 4,
        activo: false,
        _count: { productos: 2 },
      });

      const r = await servicio.desactivar(4);

      expect(prisma.proveedor.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { activo: false },
        include: CONTEO,
      });
      expect(r).toEqual({ id: 4, activo: false, productosActivos: 2 });
    });
  });
});
