import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from './usuario.types';
import { UsuariosService } from './usuarios.service';

function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

function usuario(cambios: Partial<UsuarioPublico> = {}): UsuarioPublico {
  return {
    id: 1,
    nombre: 'Ana',
    email: 'ana@empresa.com',
    rol: Rol.ADMIN,
    activo: true,
    creadoEn: new Date('2026-10-01T00:00:00Z'),
    actualizadoEn: new Date('2026-10-01T00:00:00Z'),
    ...cambios,
  };
}

describe('UsuariosService', () => {
  const actor = usuario({ id: 1, rol: Rol.ADMIN });

  let prisma: {
    usuario: Record<
      'findMany' | 'count' | 'findUnique' | 'create' | 'update',
      jest.Mock
    >;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let passwords: { hashear: jest.Mock; verificar: jest.Mock };
  let servicio: UsuariosService;

  beforeEach(() => {
    prisma = {
      usuario: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
      // Array: transacción en lote. Función: interactiva (tx = el mismo mock)
      $transaction: jest.fn((arg: unknown) =>
        Array.isArray(arg)
          ? Promise.all(arg)
          : (arg as (tx: unknown) => unknown)(prisma),
      ),
    };
    passwords = {
      hashear: jest.fn().mockResolvedValue('hash-nuevo'),
      verificar: jest.fn(),
    };
    servicio = new UsuariosService(
      prisma as unknown as PrismaService,
      passwords,
    );
  });

  describe('listar', () => {
    it('devuelve solo activos, paginado y sin passwordHash', async () => {
      prisma.usuario.findMany.mockResolvedValue([usuario()]);
      prisma.usuario.count.mockResolvedValue(21);

      const r = await servicio.listar({
        page: 2,
        limit: 20,
        incluirInactivos: false,
      });

      expect(prisma.usuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { activo: true },
          omit: { passwordHash: true },
          skip: 20,
          take: 20,
        }),
      );
      expect(prisma.usuario.count).toHaveBeenCalledWith({
        where: { activo: true },
      });
      expect(r).toMatchObject({ total: 21, page: 2, limit: 20 });
    });

    it('con incluirInactivos no filtra por activo', async () => {
      prisma.usuario.findMany.mockResolvedValue([]);
      prisma.usuario.count.mockResolvedValue(0);
      await servicio.listar({ page: 1, limit: 20, incluirInactivos: true });
      expect(prisma.usuario.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('obtener', () => {
    it('devuelve el usuario sin passwordHash', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario());
      await servicio.obtener(1);
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: { passwordHash: true },
      });
    });

    it('404 si no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('guarda el hash, nunca la contraseña, y omite el hash al responder', async () => {
      prisma.usuario.create.mockResolvedValue(usuario({ id: 5 }));
      await servicio.crear({
        nombre: 'Luis',
        email: 'luis@empresa.com',
        password: 'contraseña-larga',
        rol: Rol.VENDEDOR,
      });

      expect(passwords.hashear).toHaveBeenCalledWith('contraseña-larga');
      const args = primerArgumento(prisma.usuario.create) as {
        data: Record<string, unknown>;
        omit: unknown;
      };
      expect(args.data).toEqual({
        nombre: 'Luis',
        email: 'luis@empresa.com',
        rol: Rol.VENDEDOR,
        passwordHash: 'hash-nuevo',
      });
      expect(args.data).not.toHaveProperty('password');
      expect(args.omit).toEqual({ passwordHash: true });
    });
  });

  describe('actualizar', () => {
    it('400 con body vacío', async () => {
      await expect(servicio.actualizar(2, {}, actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('cambia el nombre sin consultar admins', async () => {
      prisma.usuario.update.mockResolvedValue(usuario({ nombre: 'Nuevo' }));
      await servicio.actualizar(2, { nombre: 'Nuevo' }, actor);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { nombre: 'Nuevo', rol: undefined, activo: undefined },
        omit: { passwordHash: true },
      });
    });

    it.each([
      ['desactivarse', { activo: false }],
      ['quitarse el rol ADMIN', { rol: Rol.VENDEDOR }],
    ])('409: un ADMIN no puede %s a sí mismo', async (_caso, dto) => {
      await expect(servicio.actualizar(1, dto, actor)).rejects.toThrow(
        'a sí mismo',
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('un ADMIN sí puede cambiarse su propio nombre', async () => {
      prisma.usuario.update.mockResolvedValue(actor);
      await servicio.actualizar(1, { nombre: 'Ana B.' }, actor);
      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it.each([
      ['desactivar', { activo: false }],
      ['degradar', { rol: Rol.BODEGUERO }],
    ])('409: no se puede %s al último admin activo', async (_caso, dto) => {
      prisma.$queryRaw.mockResolvedValue([{ id: 2 }]);
      const error = servicio.actualizar(2, dto, actor);
      await expect(error).rejects.toBeInstanceOf(ConflictException);
      await expect(error).rejects.toThrow('último administrador');
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('bloquea las filas de admins (FOR UPDATE) dentro de la transacción', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.usuario.update.mockResolvedValue(usuario({ id: 2 }));
      await servicio.actualizar(2, { activo: false }, actor);

      const sql = (primerArgumento(prisma.$queryRaw) as string[]).join('?');
      expect(sql).toContain('FOR UPDATE');
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('permite desactivar a un admin si quedan otros activos', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.usuario.update.mockResolvedValue(usuario({ id: 2 }));
      await servicio.actualizar(2, { activo: false }, actor);
      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it('permite desactivar a un no-admin aunque haya un solo admin', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      prisma.usuario.update.mockResolvedValue(usuario({ id: 3 }));
      await servicio.actualizar(3, { activo: false }, actor);
      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it('ascender a ADMIN no consulta los admins', async () => {
      prisma.usuario.update.mockResolvedValue(usuario({ id: 3 }));
      await servicio.actualizar(3, { rol: Rol.ADMIN }, actor);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('desactivar', () => {
    it('es lo mismo que PATCH { activo: false }', async () => {
      const espia = jest
        .spyOn(servicio, 'actualizar')
        .mockResolvedValue(usuario({ id: 3, activo: false }));
      await servicio.desactivar(3, actor);
      expect(espia).toHaveBeenCalledWith(3, { activo: false }, actor);
    });

    it('aplica la regla del último admin', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 2 }]);
      await expect(servicio.desactivar(2, actor)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('restablecerPassword', () => {
    it('guarda el hash de la nueva contraseña', async () => {
      prisma.usuario.update.mockResolvedValue({ id: 2 });
      await servicio.restablecerPassword(2, { password: 'otra-larga-123' });
      expect(passwords.hashear).toHaveBeenCalledWith('otra-larga-123');
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { passwordHash: 'hash-nuevo' },
        select: { id: true },
      });
    });
  });
});
