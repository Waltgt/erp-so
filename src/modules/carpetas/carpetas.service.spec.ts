import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Carpeta, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import {
  CarpetasService,
  esDescendiente,
  PROFUNDIDAD_MAXIMA,
} from './carpetas.service';

function actor(rol: Rol, id: number): UsuarioPublico {
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

function carpeta(id: number, parentId: number | null, usuarioId: number) {
  return {
    id,
    nombre: `c${id}`,
    parentId,
    usuarioId,
    creadoEn: new Date('2026-10-01T00:00:00Z'),
  } satisfies Carpeta;
}

// Base de carpetas en memoria: findFirst/findUnique filtran por los campos
// del where, así las reglas de propiedad se prueban de verdad
function crearPrisma(carpetas: Carpeta[]) {
  const coincide = (c: Carpeta, where: Partial<Carpeta>) =>
    Object.entries(where).every(
      ([campo, valor]) => c[campo as keyof Carpeta] === valor,
    );
  const prisma = {
    carpeta: {
      findFirst: jest.fn(({ where }: { where: Partial<Carpeta> }) =>
        Promise.resolve(carpetas.find((c) => coincide(c, where)) ?? null),
      ),
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(carpetas.find((c) => c.id === where.id) ?? null),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((args: { data: unknown }) => Promise.resolve(args.data)),
      update: jest.fn((args: unknown) => Promise.resolve(args)),
      delete: jest.fn().mockResolvedValue({}),
    },
    archivoMultimedia: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  // Transacción interactiva: el mismo mock hace de `tx`
  prisma.$transaction.mockImplementation(
    (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma;
}

describe('CarpetasService', () => {
  const ana = actor(Rol.VENDEDOR, 1);
  const beto = actor(Rol.BODEGUERO, 2);
  const admin = actor(Rol.ADMIN, 9);

  // Árbol de Ana: 10 → 11 → 12, y 13 en la raíz. De Beto: 20.
  const arbol = [
    carpeta(10, null, ana.id),
    carpeta(11, 10, ana.id),
    carpeta(12, 11, ana.id),
    carpeta(13, null, ana.id),
    carpeta(20, null, beto.id),
  ];

  let prisma: ReturnType<typeof crearPrisma>;
  let servicio: CarpetasService;

  beforeEach(() => {
    prisma = crearPrisma(arbol);
    servicio = new CarpetasService(prisma as unknown as PrismaService);
  });

  describe('contenido', () => {
    it('sin parentId: carpetas y archivos de la raíz del usuario', async () => {
      const r = await servicio.contenido({}, ana);
      expect(r.carpeta).toBeNull();
      expect(prisma.carpeta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuarioId: ana.id, parentId: null },
        }),
      );
      expect(prisma.archivoMultimedia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuarioId: ana.id, carpetaId: null },
          omit: { objectKey: true },
        }),
      );
    });

    it('con parentId propio: esa carpeta y su contenido', async () => {
      const r = await servicio.contenido({ parentId: 11 }, ana);
      expect(r.carpeta?.id).toBe(11);
      expect(prisma.carpeta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: ana.id, parentId: 11 } }),
      );
    });

    it('carpeta ajena: 404 (también para ADMIN: las carpetas son propias)', async () => {
      await expect(servicio.contenido({ parentId: 20 }, ana)).rejects.toThrow(
        NotFoundException,
      );
      await expect(servicio.contenido({ parentId: 20 }, admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('en la raíz: el dueño sale del token', async () => {
      await servicio.crear({ nombre: 'Fotos' }, ana);
      expect(prisma.carpeta.create).toHaveBeenCalledWith({
        data: { nombre: 'Fotos', parentId: null, usuarioId: ana.id },
      });
    });

    it('dentro de una carpeta propia', async () => {
      await servicio.crear({ nombre: 'Fotos', parentId: 10 }, ana);
      expect(prisma.carpeta.create).toHaveBeenCalledWith({
        data: { nombre: 'Fotos', parentId: 10, usuarioId: ana.id },
      });
    });

    it('dentro de una carpeta ajena o inexistente: 400', async () => {
      await expect(
        servicio.crear({ nombre: 'X', parentId: 20 }, ana),
      ).rejects.toThrow(BadRequestException);
      await expect(
        servicio.crear({ nombre: 'X', parentId: 999 }, ana),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.carpeta.create).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('body vacío: 400', async () => {
      await expect(servicio.actualizar(10, {}, ana)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('renombrar sin mover: no toma el bloqueo de movimientos', async () => {
      await servicio.actualizar(11, { nombre: 'Nuevo' }, ana);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.carpeta.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: { nombre: 'Nuevo', parentId: undefined },
      });
    });

    it('mover a otra carpeta propia (no descendiente): bloqueo y update', async () => {
      await servicio.actualizar(13, { parentId: 12 }, ana);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.carpeta.update).toHaveBeenCalledWith({
        where: { id: 13 },
        data: { nombre: undefined, parentId: 12 },
      });
    });

    it('mover a la raíz (parentId null)', async () => {
      await servicio.actualizar(12, { parentId: null }, ana);
      expect(prisma.carpeta.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: { nombre: undefined, parentId: null },
      });
    });

    it('mover dentro de sí misma: 400', async () => {
      await expect(
        servicio.actualizar(10, { parentId: 10 }, ana),
      ).rejects.toThrow('dentro de sí misma');
    });

    it('mover dentro de su hija o nieta: 400 (ciclo)', async () => {
      await expect(
        servicio.actualizar(10, { parentId: 11 }, ana),
      ).rejects.toThrow('subcarpetas');
      await expect(
        servicio.actualizar(10, { parentId: 12 }, ana),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.carpeta.update).not.toHaveBeenCalled();
    });

    it('mover a una carpeta ajena: 400', async () => {
      await expect(
        servicio.actualizar(13, { parentId: 20 }, ana),
      ).rejects.toThrow(BadRequestException);
    });

    it('carpeta ajena: 404, también para ADMIN', async () => {
      await expect(
        servicio.actualizar(20, { nombre: 'X' }, ana),
      ).rejects.toThrow(NotFoundException);
      await expect(
        servicio.actualizar(20, { nombre: 'X' }, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('eliminar', () => {
    it('vacía: se borra', async () => {
      await servicio.eliminar(13, ana);
      expect(prisma.carpeta.delete).toHaveBeenCalledWith({ where: { id: 13 } });
    });

    it('con subcarpetas: 409', async () => {
      prisma.carpeta.count.mockResolvedValue(1);
      await expect(servicio.eliminar(10, ana)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.carpeta.delete).not.toHaveBeenCalled();
    });

    it('con archivos: 409', async () => {
      prisma.archivoMultimedia.count.mockResolvedValue(2);
      await expect(servicio.eliminar(13, ana)).rejects.toThrow('2 archivo(s)');
      expect(prisma.carpeta.delete).not.toHaveBeenCalled();
    });

    it('ajena: 404', async () => {
      await expect(servicio.eliminar(20, ana)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verificarCarpetaDe', () => {
    it('carpeta del usuario indicado: pasa', async () => {
      await expect(
        servicio.verificarCarpetaDe(20, beto.id, 'carpetaId'),
      ).resolves.toBeUndefined();
    });

    it('de otro usuario: 400 con el nombre del campo', async () => {
      await expect(
        servicio.verificarCarpetaDe(20, ana.id, 'carpetaId'),
      ).rejects.toThrow('carpetaId debe ser una carpeta');
    });
  });
});

describe('esDescendiente', () => {
  it('sube por el árbol hasta la raíz', async () => {
    const prisma = crearPrisma([
      carpeta(1, null, 1),
      carpeta(2, 1, 1),
      carpeta(3, 2, 1),
      carpeta(4, null, 1),
    ]);
    const tx = prisma as never;
    await expect(esDescendiente(tx, 3, 1)).resolves.toBe(true);
    await expect(esDescendiente(tx, 3, 2)).resolves.toBe(true);
    await expect(esDescendiente(tx, 1, 3)).resolves.toBe(false);
    await expect(esDescendiente(tx, 4, 1)).resolves.toBe(false);
  });

  it('un ciclo ya existente en los datos no lo deja en un bucle infinito', async () => {
    const prisma = crearPrisma([carpeta(1, 2, 1), carpeta(2, 1, 1)]);
    await expect(esDescendiente(prisma as never, 1, 99)).rejects.toThrow(
      `${PROFUNDIDAD_MAXIMA} niveles`,
    );
  });
});
