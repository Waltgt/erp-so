import {
  BadRequestException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PassThrough, Readable } from 'node:stream';
import {
  ArchivoMultimedia,
  Rol,
  TipoArchivo,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlmacenamientoEnMemoria } from '../almacenamiento/almacenamiento-en-memoria';
import { CarpetasService } from '../carpetas/carpetas.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ArchivosService } from './archivos.service';
import { ModoUrl } from './dto/url-archivo.dto';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MB = 1024 * 1024;

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

function archivo(id: number, usuarioId: number): ArchivoMultimedia {
  return {
    id,
    objectKey: `00000000-0000-4000-8000-00000000000${id}`,
    nombreOriginal: 'cancion.mp3',
    mimeType: 'audio/mpeg',
    tamanoBytes: 3,
    tipo: TipoArchivo.MUSICA,
    duracionSeg: null,
    carpetaId: null,
    usuarioId,
    creadoEn: new Date('2026-10-01T00:00:00Z'),
  };
}

function argumento<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown[][])[0][0] as T;
}

describe('ArchivosService', () => {
  const ana = actor(Rol.VENDEDOR, 1);
  const beto = actor(Rol.BODEGUERO, 2);
  const admin = actor(Rol.ADMIN, 9);
  // Archivo 5 es de Beto
  const deBeto = archivo(5, beto.id);

  let almacenamiento: AlmacenamientoEnMemoria;
  let prisma: {
    archivoMultimedia: Record<
      'create' | 'findMany' | 'count' | 'findFirst' | 'update' | 'delete',
      jest.Mock
    >;
    $transaction: jest.Mock;
  };
  let carpetas: { verificarCarpetaDe: jest.Mock };
  let servicio: ArchivosService;
  let logError: jest.SpyInstance;
  let logInfo: jest.SpyInstance;

  beforeEach(() => {
    almacenamiento = new AlmacenamientoEnMemoria();
    prisma = {
      archivoMultimedia: {
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          // Lo que devolvería Prisma con omit: { objectKey: true }
          const fila: Record<string, unknown> = { id: 1, ...args.data };
          delete fila.objectKey;
          return Promise.resolve(fila);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        // Respeta el filtro de propiedad del where y el omit
        findFirst: jest.fn(
          ({
            where,
            omit,
          }: {
            where: { id: number; usuarioId?: number };
            omit?: { objectKey?: boolean };
          }) => {
            const visible =
              where.id === deBeto.id &&
              (where.usuarioId === undefined ||
                where.usuarioId === deBeto.usuarioId);
            if (!visible) {
              return Promise.resolve(null);
            }
            const fila: Partial<ArchivoMultimedia> = { ...deBeto };
            if (omit?.objectKey) {
              delete fila.objectKey;
            }
            return Promise.resolve(fila);
          },
        ),
        update: jest.fn((args: unknown) => Promise.resolve(args)),
        delete: jest.fn().mockResolvedValue(deBeto),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    carpetas = { verificarCarpetaDe: jest.fn().mockResolvedValue(undefined) };
    const variables: Record<string, number> = {
      ARCHIVO_TAMANO_MAX_MB: 1,
      URL_FIRMADA_SEGUNDOS: 900,
    };
    const config = { get: jest.fn((nombre: string) => variables[nombre]) };
    servicio = new ArchivosService(
      prisma as unknown as PrismaService,
      almacenamiento,
      carpetas as unknown as CarpetasService,
      config as never,
    );
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    logInfo = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
    logInfo.mockRestore();
  });

  describe('subir', () => {
    const mp3 = (datos = Buffer.from('ID3')) => ({
      contenido: Readable.from([datos]),
      nombre: 'C:\\fakepath\\canción.mp3',
      mimeType: 'audio/mpeg',
    });

    it('mp3: va al almacenamiento con un UUID y a la tabla con el nombre original', async () => {
      const r = await servicio.subir(mp3(), undefined, ana);

      expect(almacenamiento.objetos.size).toBe(1);
      const [objectKey, objeto] = [...almacenamiento.objetos][0];
      expect(objectKey).toMatch(UUID);
      expect(objeto.datos.toString()).toBe('ID3');
      expect(objeto.contentType).toBe('audio/mpeg');

      const { data } = argumento<{ data: Record<string, unknown> }>(
        prisma.archivoMultimedia.create,
      );
      expect(data).toEqual({
        objectKey,
        nombreOriginal: 'canción.mp3',
        mimeType: 'audio/mpeg',
        tamanoBytes: 3,
        tipo: TipoArchivo.MUSICA,
        carpetaId: null,
        usuarioId: ana.id,
      });
      // La respuesta no expone el objectKey
      expect(r).not.toHaveProperty('objectKey');
    });

    it('Content-Type con parámetros y mayúsculas se normaliza', async () => {
      await servicio.subir(
        {
          contenido: Readable.from([Buffer.from('hola')]),
          nombre: 'nota.txt',
          mimeType: 'Text/Plain; charset=UTF-8',
        },
        undefined,
        ana,
      );
      const { data } = argumento<{ data: Record<string, unknown> }>(
        prisma.archivoMultimedia.create,
      );
      expect(data.mimeType).toBe('text/plain');
      expect(data.tipo).toBe(TipoArchivo.DOCUMENTO);
    });

    it('.exe: 415 sin tocar el almacenamiento, y el stream se descarta', async () => {
      const contenido = new PassThrough();
      const fin = new Promise((resolver) => contenido.once('end', resolver));
      await expect(
        servicio.subir(
          {
            contenido,
            nombre: 'virus.exe',
            mimeType: 'application/x-msdownload',
          },
          undefined,
          ana,
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);
      contenido.end(Buffer.alloc(10));
      await expect(fin).resolves.toBeUndefined();
      expect(almacenamiento.objetos.size).toBe(0);
      expect(prisma.archivoMultimedia.create).not.toHaveBeenCalled();
    });

    it('mayor al límite: 413 y el almacenamiento queda igual', async () => {
      await expect(
        servicio.subir(mp3(Buffer.alloc(MB + 1)), undefined, ana),
      ).rejects.toThrow(PayloadTooLargeException);
      expect(almacenamiento.objetos.size).toBe(0);
      expect(prisma.archivoMultimedia.create).not.toHaveBeenCalled();
    });

    it('justo el límite: se acepta', async () => {
      await servicio.subir(mp3(Buffer.alloc(MB)), undefined, ana);
      expect(almacenamiento.objetos.size).toBe(1);
    });

    it('vacío: 400 y no queda el objeto', async () => {
      await expect(
        servicio.subir(mp3(Buffer.alloc(0)), undefined, ana),
      ).rejects.toThrow(BadRequestException);
      expect(almacenamiento.objetos.size).toBe(0);
    });

    it('carpeta destino: debe ser del usuario del token (también para ADMIN)', async () => {
      await servicio.subir(mp3(), 7, admin);
      expect(carpetas.verificarCarpetaDe).toHaveBeenCalledWith(
        7,
        admin.id,
        'carpetaId',
      );
      const { data } = argumento<{ data: Record<string, unknown> }>(
        prisma.archivoMultimedia.create,
      );
      expect(data.carpetaId).toBe(7);
    });

    it('carpeta ajena: 400 sin subir nada', async () => {
      carpetas.verificarCarpetaDe.mockRejectedValue(
        new BadRequestException('carpetaId debe ser una carpeta...'),
      );
      await expect(servicio.subir(mp3(), 20, ana)).rejects.toThrow(
        BadRequestException,
      );
      expect(almacenamiento.objetos.size).toBe(0);
    });

    it('si el insert falla, se borra el objeto del almacenamiento', async () => {
      prisma.archivoMultimedia.create.mockRejectedValue(new Error('FK'));
      await expect(servicio.subir(mp3(), undefined, ana)).rejects.toThrow('FK');
      expect(almacenamiento.objetos.size).toBe(0);
    });

    it('si el insert falla y Garage tampoco borra: object_key huérfano en el log', async () => {
      prisma.archivoMultimedia.create.mockRejectedValue(new Error('FK'));
      almacenamiento.fallarAlBorrar = new Error('Garage caído');
      await expect(servicio.subir(mp3(), undefined, ana)).rejects.toThrow('FK');
      const [objectKey] = [...almacenamiento.objetos.keys()];
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(`huérfano en el almacenamiento: ${objectKey}`),
      );
    });

    it('si Garage falla al subir: se propaga el error y no hay fila', async () => {
      almacenamiento.fallarAlSubir = new Error('Garage caído');
      await expect(servicio.subir(mp3(), undefined, ana)).rejects.toThrow(
        'Garage caído',
      );
      expect(prisma.archivoMultimedia.create).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    const base = { page: 2, limit: 10 };

    it('usuario normal: solo los suyos, paginado y sin objectKey', async () => {
      await servicio.listar(base, ana);
      const args = argumento<Record<string, unknown>>(
        prisma.archivoMultimedia.findMany,
      );
      expect(args).toMatchObject({
        where: { usuarioId: ana.id },
        omit: { objectKey: true },
        skip: 10,
        take: 10,
      });
    });

    it('ADMIN: todos', async () => {
      await servicio.listar(base, admin);
      expect(
        argumento<{ where: unknown }>(prisma.archivoMultimedia.findMany).where,
      ).toEqual({});
    });

    it('filtros tipo, carpeta y búsqueda (con comodines escapados)', async () => {
      await servicio.listar(
        { ...base, tipo: TipoArchivo.IMAGEN, carpetaId: 3, buscar: '50%' },
        ana,
      );
      expect(
        argumento<{ where: unknown }>(prisma.archivoMultimedia.findMany).where,
      ).toEqual({
        usuarioId: ana.id,
        tipo: TipoArchivo.IMAGEN,
        carpetaId: 3,
        nombreOriginal: { contains: '50\\%', mode: 'insensitive' },
      });
    });
  });

  describe('obtener y urlFirmada', () => {
    const conObjeto = () =>
      almacenamiento.objetos.set(deBeto.objectKey, {
        datos: Buffer.from('ID3'),
        contentType: 'audio/mpeg',
      });
    const parametros = (url: string) => new URL(url).searchParams;

    it('usuario A pide el archivo de B: 404', async () => {
      conObjeto();
      await expect(servicio.obtener(deBeto.id, ana)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        servicio.urlFirmada(deBeto.id, ModoUrl.Ver, ana),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADMIN sí lo ve, sin objectKey', async () => {
      const r = await servicio.obtener(deBeto.id, admin);
      expect(r.id).toBe(deBeto.id);
      expect(r).not.toHaveProperty('objectKey');
    });

    it('modo ver: inline con el MIME guardado y la vigencia configurada', async () => {
      conObjeto();
      const antes = Date.now();
      const r = await servicio.urlFirmada(deBeto.id, ModoUrl.Ver, beto);

      expect(r.url).toContain(deBeto.objectKey);
      const p = parametros(r.url);
      expect(p.get('X-Amz-Expires')).toBe('900');
      expect(p.get('response-content-type')).toBe('audio/mpeg');
      expect(p.get('response-content-disposition')).toMatch(
        /^inline; filename="cancion.mp3"/,
      );
      expect(r.expiraEn.getTime()).toBeGreaterThanOrEqual(antes + 900_000);
      expect(r.expiraEn.getTime()).toBeLessThanOrEqual(Date.now() + 900_000);
    });

    it('modo descargar: attachment con el nombre original', async () => {
      conObjeto();
      const r = await servicio.urlFirmada(deBeto.id, ModoUrl.Descargar, admin);
      expect(parametros(r.url).get('response-content-disposition')).toBe(
        `attachment; filename="cancion.mp3"; filename*=UTF-8''cancion.mp3`,
      );
    });

    it('registra usuario, archivo y modo, pero no la URL', async () => {
      conObjeto();
      const r = await servicio.urlFirmada(deBeto.id, ModoUrl.Ver, admin);
      expect(logInfo).toHaveBeenCalledWith(
        `URL firmada emitida: usuario ${admin.id}, archivo ${deBeto.id}, modo ver`,
      );
      const mensajes = logInfo.mock.calls.flat().join(' ');
      expect(mensajes).not.toContain(r.url);
      expect(mensajes).not.toContain(deBeto.objectKey);
    });

    it('fila sin objeto en el almacenamiento: 404 y se registra en el log', async () => {
      await expect(
        servicio.urlFirmada(deBeto.id, ModoUrl.Ver, beto),
      ).rejects.toThrow('no está disponible');
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(deBeto.objectKey),
      );
    });
  });

  describe('actualizar', () => {
    it('body vacío: 400', async () => {
      await expect(servicio.actualizar(deBeto.id, {}, beto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('renombrar: solo metadatos', async () => {
      await servicio.actualizar(deBeto.id, { nombreOriginal: 'b.mp3' }, beto);
      expect(prisma.archivoMultimedia.update).toHaveBeenCalledWith({
        where: { id: deBeto.id },
        data: { nombreOriginal: 'b.mp3', carpetaId: undefined },
        omit: { objectKey: true },
      });
      expect(carpetas.verificarCarpetaDe).not.toHaveBeenCalled();
    });

    it('mover a la raíz (null) no verifica carpeta', async () => {
      await servicio.actualizar(deBeto.id, { carpetaId: null }, beto);
      expect(carpetas.verificarCarpetaDe).not.toHaveBeenCalled();
    });

    it('ADMIN mueve un archivo ajeno: la carpeta debe ser del DUEÑO', async () => {
      await servicio.actualizar(deBeto.id, { carpetaId: 20 }, admin);
      expect(carpetas.verificarCarpetaDe).toHaveBeenCalledWith(
        20,
        beto.id,
        'carpetaId',
      );
    });

    it('archivo ajeno (no ADMIN): 404', async () => {
      await expect(
        servicio.actualizar(deBeto.id, { nombreOriginal: 'x' }, ana),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.archivoMultimedia.update).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    beforeEach(() => {
      almacenamiento.objetos.set(deBeto.objectKey, {
        datos: Buffer.from('ID3'),
        contentType: 'audio/mpeg',
      });
    });

    it('borra primero la fila y después el objeto', async () => {
      await servicio.eliminar(deBeto.id, beto);
      expect(prisma.archivoMultimedia.delete).toHaveBeenCalledWith({
        where: { id: deBeto.id },
      });
      expect(almacenamiento.objetos.has(deBeto.objectKey)).toBe(false);
    });

    it('ADMIN puede borrar un archivo ajeno', async () => {
      await servicio.eliminar(deBeto.id, admin);
      expect(almacenamiento.objetos.size).toBe(0);
    });

    it('ajeno (no ADMIN): 404 y no borra nada', async () => {
      await expect(servicio.eliminar(deBeto.id, ana)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.archivoMultimedia.delete).not.toHaveBeenCalled();
      expect(almacenamiento.objetos.size).toBe(1);
    });

    it('si Garage falla: la fila queda borrada y el object_key va al log', async () => {
      almacenamiento.fallarAlBorrar = new Error('Garage caído');
      await expect(servicio.eliminar(deBeto.id, beto)).resolves.toBeUndefined();
      expect(prisma.archivoMultimedia.delete).toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(deBeto.objectKey),
      );
    });

    it('si falla el borrado de la fila, el objeto no se toca', async () => {
      prisma.archivoMultimedia.delete.mockRejectedValue(new Error('P2025'));
      await expect(servicio.eliminar(deBeto.id, beto)).rejects.toThrow('P2025');
      expect(almacenamiento.objetos.size).toBe(1);
    });
  });
});
