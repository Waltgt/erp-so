import request from 'supertest';
import { App } from 'supertest/types';
import {
  ArchivoMultimedia,
  Carpeta,
  Rol,
  TipoArchivo,
} from '../src/generated/prisma/client';
import { Almacenamiento } from '../src/modules/almacenamiento/almacenamiento';
import { AlmacenamientoEnMemoria } from '../src/modules/almacenamiento/almacenamiento-en-memoria';
import { ArchivosModule } from '../src/modules/archivos/archivos.module';
import { CarpetasModule } from '../src/modules/carpetas/carpetas.module';
import { AppPrueba, crearAppPrueba } from './utils/app-prueba';

const FECHA = new Date('2026-10-01T00:00:00Z');
const MB = 1024 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Ids de app-prueba: ADMIN 1, VENDEDOR 2, BODEGUERO 3, COMPRAS 4
const VENDEDOR = 2;
const BODEGUERO = 3;

type Where = Record<string, unknown>;
type OpcionesOmit = { objectKey?: boolean };

// Igualdad simple campo a campo (alcanza para los where de estos servicios)
function coincide(fila: object, where: Where = {}): boolean {
  return Object.entries(where).every(
    ([campo, valor]) => (fila as Where)[campo] === valor,
  );
}

function aplicar<T extends object>(fila: T, data: Partial<T>): T {
  const definidos = Object.entries(data).filter(([, v]) => v !== undefined);
  return Object.assign(fila, Object.fromEntries(definidos));
}

function crearPrismaFalso(archivos: ArchivoMultimedia[], carpetas: Carpeta[]) {
  const sinKey = (a: ArchivoMultimedia, omit?: OpcionesOmit) => {
    const copia: Partial<ArchivoMultimedia> = { ...a };
    if (omit?.objectKey) {
      delete copia.objectKey;
    }
    return copia;
  };
  const archivo = (where: Where) => archivos.find((a) => coincide(a, where));
  const carpeta = (where: Where) => carpetas.find((c) => coincide(c, where));

  const prisma = {
    archivoMultimedia: {
      create: ({
        data,
        omit,
      }: {
        data: ArchivoMultimedia;
        omit?: OpcionesOmit;
      }) => {
        const nuevo: ArchivoMultimedia = {
          ...data,
          id: Math.max(0, ...archivos.map((a) => a.id)) + 1,
          duracionSeg: null,
          creadoEn: FECHA,
        };
        archivos.push(nuevo);
        return Promise.resolve(sinKey(nuevo, omit));
      },
      findFirst: ({ where, omit }: { where: Where; omit?: OpcionesOmit }) => {
        const a = archivo(where);
        return Promise.resolve(a ? sinKey(a, omit) : null);
      },
      // include (listado): dueño y carpeta resumidos
      findMany: ({
        where,
        omit,
        include,
      }: {
        where: Where;
        omit?: OpcionesOmit;
        include?: unknown;
      }) =>
        Promise.resolve(
          archivos
            .filter((a) => coincide(a, where))
            .map((a) => {
              const c = carpetas.find((x) => x.id === a.carpetaId);
              return include
                ? {
                    ...sinKey(a, omit),
                    usuario: {
                      id: a.usuarioId,
                      nombre: `Usuario ${a.usuarioId}`,
                    },
                    carpeta: c ? { id: c.id, nombre: c.nombre } : null,
                  }
                : sinKey(a, omit);
            }),
        ),
      count: ({ where }: { where: Where }) =>
        Promise.resolve(archivos.filter((a) => coincide(a, where)).length),
      update: ({
        where,
        data,
        omit,
      }: {
        where: Where;
        data: Partial<ArchivoMultimedia>;
        omit?: OpcionesOmit;
      }) => Promise.resolve(sinKey(aplicar(archivo(where)!, data), omit)),
      delete: ({ where }: { where: Where }) => {
        const a = archivo(where)!;
        archivos.splice(archivos.indexOf(a), 1);
        return Promise.resolve(a);
      },
    },
    carpeta: {
      findFirst: ({ where }: { where: Where }) =>
        Promise.resolve(carpeta(where) ?? null),
      findUnique: ({ where }: { where: Where }) =>
        Promise.resolve(carpeta(where) ?? null),
      findMany: ({ where }: { where: Where }) =>
        Promise.resolve(carpetas.filter((c) => coincide(c, where))),
      count: ({ where }: { where: Where }) =>
        Promise.resolve(carpetas.filter((c) => coincide(c, where)).length),
      update: ({ where, data }: { where: Where; data: Partial<Carpeta> }) =>
        Promise.resolve(aplicar(carpeta(where)!, data)),
    },
    $executeRaw: () => Promise.resolve(0),
    $transaction: (arg: unknown): Promise<unknown> =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
  };
  return prisma;
}

describe('Carpetas y archivos (e2e)', () => {
  let prueba: AppPrueba;
  let servidor: App;
  let almacenamiento: AlmacenamientoEnMemoria;
  let archivos: ArchivoMultimedia[];
  let carpetas: Carpeta[];

  beforeEach(async () => {
    almacenamiento = new AlmacenamientoEnMemoria();
    // Carpetas del VENDEDOR: 1 "Música" > 2 "Rock". Del BODEGUERO: 3.
    carpetas = [
      {
        id: 1,
        nombre: 'Música',
        parentId: null,
        usuarioId: VENDEDOR,
        creadoEn: FECHA,
      },
      {
        id: 2,
        nombre: 'Rock',
        parentId: 1,
        usuarioId: VENDEDOR,
        creadoEn: FECHA,
      },
      {
        id: 3,
        nombre: 'Bodega',
        parentId: null,
        usuarioId: BODEGUERO,
        creadoEn: FECHA,
      },
    ];
    // Archivo 10: del BODEGUERO, en el almacenamiento
    archivos = [
      {
        id: 10,
        objectKey: '00000000-0000-4000-8000-000000000010',
        nombreOriginal: 'inventario.txt',
        mimeType: 'text/plain',
        tamanoBytes: 5,
        tipo: TipoArchivo.DOCUMENTO,
        duracionSeg: null,
        carpetaId: 3,
        usuarioId: BODEGUERO,
        creadoEn: FECHA,
      },
    ];
    almacenamiento.objetos.set(archivos[0].objectKey, {
      datos: Buffer.from('cajas'),
      contentType: 'text/plain',
    });

    prueba = await crearAppPrueba(
      [CarpetasModule, ArchivosModule],
      crearPrismaFalso(archivos, carpetas),
      {
        config: { ARCHIVO_TAMANO_MAX_MB: 1, URL_FIRMADA_SEGUNDOS: 900 },
        reemplazos: [[Almacenamiento, almacenamiento]],
      },
    );
    servidor = prueba.app.getHttpServer();
  });

  afterEach(async () => {
    await prueba.app.close();
  });

  const subir = (rol: Rol) =>
    request(servidor)
      .post('/api/archivos')
      .set('Authorization', prueba.auth(rol));

  it('sin token: 401', async () => {
    expect((await prueba.sinToken().get('/api/archivos')).status).toBe(401);
    expect((await prueba.sinToken().get('/api/carpetas')).status).toBe(401);
  });

  describe('POST /api/archivos', () => {
    it('mp3: 201, en el almacenamiento con UUID y en la tabla con el nombre original', async () => {
      const r = await subir(Rol.VENDEDOR)
        .field('carpetaId', '2')
        .attach('archivo', Buffer.from('ID3 datos'), {
          filename: 'canción.mp3',
          contentType: 'audio/mpeg',
        });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        nombreOriginal: 'canción.mp3',
        mimeType: 'audio/mpeg',
        tamanoBytes: 9,
        tipo: TipoArchivo.MUSICA,
        carpetaId: 2,
        usuarioId: VENDEDOR,
      });
      expect(r.body).not.toHaveProperty('objectKey');

      const fila = archivos.find((a) => a.id === (r.body as { id: number }).id);
      expect(fila?.objectKey).toMatch(UUID);
      expect(
        almacenamiento.objetos.get(fila!.objectKey)?.datos.toString(),
      ).toBe('ID3 datos');
    });

    it('.exe: 415 y no se guarda nada', async () => {
      const r = await subir(Rol.VENDEDOR).attach('archivo', Buffer.from('MZ'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      });
      expect(r.status).toBe(415);
      expect(almacenamiento.objetos.size).toBe(1);
      expect(archivos).toHaveLength(1);
    });

    it('mayor al límite (1 MB): 413 y el almacenamiento queda igual', async () => {
      const r = await subir(Rol.VENDEDOR).attach(
        'archivo',
        Buffer.alloc(MB + 1),
        {
          filename: 'grande.mp3',
          contentType: 'audio/mpeg',
        },
      );
      expect(r.status).toBe(413);
      expect(almacenamiento.objetos.size).toBe(1);
      expect(archivos).toHaveLength(1);
    });

    it('carpeta de otro usuario: 400 sin guardar nada', async () => {
      const r = await subir(Rol.VENDEDOR)
        .field('carpetaId', '3')
        .attach('archivo', Buffer.from('ID3'), {
          filename: 'a.mp3',
          contentType: 'audio/mpeg',
        });
      expect(r.status).toBe(400);
      expect(almacenamiento.objetos.size).toBe(1);
    });

    it('carpetaId después del archivo: 400 y se deshace la subida', async () => {
      const r = await subir(Rol.VENDEDOR)
        .attach('archivo', Buffer.from('ID3'), {
          filename: 'a.mp3',
          contentType: 'audio/mpeg',
        })
        .field('carpetaId', '2');
      expect(r.status).toBe(400);
      expect(almacenamiento.objetos.size).toBe(1);
      expect(archivos).toHaveLength(1);
    });

    it('campo desconocido o carpetaId inválido: 400', async () => {
      const extra = await subir(Rol.VENDEDOR)
        .field('usuarioId', '1')
        .attach('archivo', Buffer.from('ID3'), {
          filename: 'a.mp3',
          contentType: 'audio/mpeg',
        });
      expect(extra.status).toBe(400);

      const invalido = await subir(Rol.VENDEDOR)
        .field('carpetaId', 'abc')
        .attach('archivo', Buffer.from('ID3'), {
          filename: 'a.mp3',
          contentType: 'audio/mpeg',
        });
      expect(invalido.status).toBe(400);
      expect(almacenamiento.objetos.size).toBe(1);
    });

    it('sin archivo: 400; cuerpo que no es multipart: 415', async () => {
      expect((await subir(Rol.VENDEDOR).field('carpetaId', '1')).status).toBe(
        400,
      );
      expect((await subir(Rol.VENDEDOR).send({ carpetaId: 1 })).status).toBe(
        415,
      );
    });

    it('archivo en otro campo: 400', async () => {
      const r = await subir(Rol.VENDEDOR).attach('foto', Buffer.from('x'), {
        filename: 'a.png',
        contentType: 'image/png',
      });
      expect(r.status).toBe(400);
    });

    it('ADMIN sube a una carpeta ajena: 400 (las carpetas siempre son propias)', async () => {
      const r = await subir(Rol.ADMIN)
        .field('carpetaId', '1')
        .attach('archivo', Buffer.from('ID3'), {
          filename: 'a.mp3',
          contentType: 'audio/mpeg',
        });
      expect(r.status).toBe(400);
    });
  });

  describe('propiedad', () => {
    it('VENDEDOR pide el archivo del BODEGUERO: 404 en todo', async () => {
      const r = prueba.como(Rol.VENDEDOR);
      expect((await r.get('/api/archivos/10')).status).toBe(404);
      expect((await r.get('/api/archivos/10/url')).status).toBe(404);
      expect(
        (await r.patch('/api/archivos/10', { nombreOriginal: 'x.txt' })).status,
      ).toBe(404);
      expect((await r.delete('/api/archivos/10')).status).toBe(404);
      expect((await r.get('/api/archivos')).body).toMatchObject({ total: 0 });
    });

    it('ADMIN sí lo ve y lo lista', async () => {
      const r = prueba.como(Rol.ADMIN);
      const detalle = await r.get('/api/archivos/10');
      expect(detalle.status).toBe(200);
      expect(detalle.body).not.toHaveProperty('objectKey');
      expect((await r.get('/api/archivos')).body).toMatchObject({ total: 1 });
    });

    it('el listado trae dueño y carpeta; ADMIN filtra por ?usuarioId=', async () => {
      const r = prueba.como(Rol.ADMIN);
      const delBodeguero = await r.get(`/api/archivos?usuarioId=${BODEGUERO}`);
      expect(delBodeguero.body).toMatchObject({
        total: 1,
        data: [
          {
            id: 10,
            usuario: { id: BODEGUERO },
            carpeta: { id: 3, nombre: 'Bodega' },
          },
        ],
      });
      expect(
        (await r.get(`/api/archivos?usuarioId=${VENDEDOR}`)).body,
      ).toMatchObject({ total: 0 });
    });

    it('?usuarioId= con otro rol: 403', async () => {
      const res = await prueba
        .como(Rol.BODEGUERO)
        .get(`/api/archivos?usuarioId=${BODEGUERO}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/archivos/:id/url', () => {
    type UrlRespuesta = { url: string; expiraEn: string };
    const pedir = (ruta: string) => prueba.como(Rol.BODEGUERO).get(ruta);

    it('sin modo = ver: inline, MIME guardado y sin caché', async () => {
      const r = await pedir('/api/archivos/10/url');
      expect(r.status).toBe(200);
      expect(r.headers['cache-control']).toBe('private, no-store');

      const { url, expiraEn } = r.body as UrlRespuesta;
      const p = new URL(url).searchParams;
      expect(p.get('response-content-type')).toBe('text/plain');
      expect(p.get('response-content-disposition')).toMatch(/^inline;/);
      expect(Date.parse(expiraEn)).toBeGreaterThan(Date.now() + 899_000);
    });

    it('modo=descargar: attachment con el nombre original (tildes incluidas)', async () => {
      archivos[0].nombreOriginal = 'inventario año.txt';
      const r = await pedir('/api/archivos/10/url?modo=descargar');
      const p = new URL((r.body as UrlRespuesta).url).searchParams;
      expect(p.get('response-content-disposition')).toBe(
        `attachment; filename="inventario a_o.txt"; filename*=UTF-8''inventario%20a%C3%B1o.txt`,
      );
    });

    it('modo inválido: 400', async () => {
      expect((await pedir('/api/archivos/10/url?modo=borrar')).status).toBe(
        400,
      );
    });

    it('ADMIN pide la URL de un archivo ajeno: 200', async () => {
      expect(
        (await prueba.como(Rol.ADMIN).get('/api/archivos/10/url')).status,
      ).toBe(200);
    });

    it('el endpoint de descarga por proxy ya no existe', async () => {
      expect((await pedir('/api/archivos/10/descarga')).status).toBe(404);
    });
  });

  it('PATCH: renombrar y mover a la raíz', async () => {
    const r = await prueba.como(Rol.BODEGUERO).patch('/api/archivos/10', {
      nombreOriginal: 'stock.txt',
      carpetaId: null,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      nombreOriginal: 'stock.txt',
      carpetaId: null,
    });
  });

  it('DELETE: 204, sin fila y sin objeto', async () => {
    const r = await prueba.como(Rol.BODEGUERO).delete('/api/archivos/10');
    expect(r.status).toBe(204);
    expect(archivos).toHaveLength(0);
    expect(almacenamiento.objetos.size).toBe(0);
  });

  describe('carpetas', () => {
    it('GET: contenido de la raíz del usuario', async () => {
      const r = await prueba.como(Rol.VENDEDOR).get('/api/carpetas');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        carpeta: null,
        carpetas: [{ id: 1, nombre: 'Música' }],
        archivos: [],
      });
    });

    it('borrar una carpeta con contenido: 409', async () => {
      expect(
        (await prueba.como(Rol.VENDEDOR).delete('/api/carpetas/1')).status,
      ).toBe(409);
    });

    it('mover una carpeta dentro de su propia hija: 400', async () => {
      const r = await prueba
        .como(Rol.VENDEDOR)
        .patch('/api/carpetas/1', { parentId: 2 });
      expect(r.status).toBe(400);
      expect(carpetas[0].parentId).toBeNull();
    });

    it('carpeta ajena: 404 (también para ADMIN)', async () => {
      expect(
        (await prueba.como(Rol.ADMIN).get('/api/carpetas?parentId=1')).status,
      ).toBe(404);
    });
  });
});
