import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ClientesService } from './clientes.service';

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

describe('ClientesService', () => {
  const admin = actor(Rol.ADMIN);
  const vendedor = actor(Rol.VENDEDOR);

  let prisma: {
    cliente: Record<
      'findMany' | 'count' | 'findUnique' | 'create' | 'update',
      jest.Mock
    >;
    $transaction: jest.Mock;
  };
  let servicio: ClientesService;

  beforeEach(() => {
    prisma = {
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    servicio = new ClientesService(prisma as unknown as PrismaService);
  });

  describe('listar', () => {
    const base = { page: 1, limit: 20, incluirInactivos: false };

    it('por defecto solo activos, ordenado por nombre', async () => {
      await servicio.listar(base, vendedor);
      expect(prisma.cliente.findMany).toHaveBeenCalledWith({
        where: { activo: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      });
      expect(prisma.cliente.count).toHaveBeenCalledWith({
        where: { activo: true },
      });
    });

    it('buscar: nombre sin distinguir mayúsculas O NIT normalizado', async () => {
      await servicio.listar({ ...base, buscar: '1234567-8' }, vendedor);
      const { where } = primerArgumento(prisma.cliente.findMany) as {
        where: unknown;
      };
      expect(where).toEqual({
        activo: true,
        OR: [
          { nombre: { contains: '1234567-8', mode: 'insensitive' } },
          { nit: { contains: '12345678' } },
        ],
      });
    });

    it('buscar escapa los comodines de LIKE', async () => {
      await servicio.listar({ ...base, buscar: '50%_x' }, vendedor);
      const { where } = primerArgumento(prisma.cliente.findMany) as {
        where: { OR: { nombre?: { contains: string } }[] };
      };
      expect(where.OR[0].nombre?.contains).toBe('50\\%\\_x');
    });

    it('buscar sin nada válido para NIT (ej. "-") solo busca en el nombre', async () => {
      await servicio.listar({ ...base, buscar: '-' }, vendedor);
      const { where } = primerArgumento(prisma.cliente.findMany) as {
        where: { OR: unknown[] };
      };
      expect(where.OR).toHaveLength(1);
    });

    it('ADMIN con incluirInactivos: no filtra por activo', async () => {
      await servicio.listar({ ...base, incluirInactivos: true }, admin);
      expect(prisma.cliente.count).toHaveBeenCalledWith({ where: {} });
    });

    it('VENDEDOR con incluirInactivos: 403', async () => {
      await expect(
        servicio.listar({ ...base, incluirInactivos: true }, vendedor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.cliente.findMany).not.toHaveBeenCalled();
    });

    it('devuelve { data, total, page, limit }', async () => {
      prisma.cliente.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.cliente.count.mockResolvedValue(21);
      await expect(
        servicio.listar({ ...base, page: 2 }, vendedor),
      ).resolves.toEqual({ data: [{ id: 1 }], total: 21, page: 2, limit: 20 });
    });
  });

  describe('obtener', () => {
    it('devuelve el cliente aunque esté inactivo (historial)', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 3, activo: false });
      await expect(servicio.obtener(3)).resolves.toMatchObject({
        activo: false,
      });
      expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
      });
    });

    it('404 si no existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('guarda los opcionales ausentes como null', async () => {
      await servicio.crear({ nit: 'CF', nombre: 'Consumidor' });
      expect(prisma.cliente.create).toHaveBeenCalledWith({
        data: {
          nit: 'CF',
          nombre: 'Consumidor',
          email: null,
          telefono: null,
          direccion: null,
        },
      });
    });
  });

  describe('actualizar', () => {
    it('400 con body vacío', async () => {
      await expect(servicio.actualizar(1, {}, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('VENDEDOR puede editar datos', async () => {
      await servicio.actualizar(1, { nombre: 'Nuevo', email: null }, vendedor);
      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          nit: undefined,
          nombre: 'Nuevo',
          email: null,
          telefono: undefined,
          direccion: undefined,
          activo: undefined,
        },
      });
    });

    it.each([true, false])('VENDEDOR con activo=%s: 403', async (activo) => {
      await expect(
        servicio.actualizar(1, { activo }, vendedor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('ADMIN reactiva un cliente con activo=true', async () => {
      await servicio.actualizar(1, { activo: true }, admin);
      expect(primerArgumento(prisma.cliente.update)).toMatchObject({
        data: { activo: true },
      });
    });
  });

  describe('desactivar', () => {
    it('pone activo=false (borrado lógico)', async () => {
      await servicio.desactivar(4);
      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { activo: false },
      });
    });
  });
});
