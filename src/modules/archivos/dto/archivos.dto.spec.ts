import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TipoArchivo } from '../../../generated/prisma/client';
import { tipoDesdeMime } from '../tipos-permitidos';
import { ActualizarArchivoDto } from './actualizar-archivo.dto';
import {
  limpiarNombreArchivo,
  NOMBRE_ARCHIVO_MAXIMO,
  nombreArchivoSubido,
  recortarNombreArchivo,
} from './campos-archivo';
import { ListarArchivosQueryDto } from './listar-archivos.dto';
import { SubirArchivoDto } from './subir-archivo.dto';

function validar<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('tipoDesdeMime (lista blanca)', () => {
  it.each([
    ['audio/mpeg', TipoArchivo.MUSICA],
    ['audio/x-wav', TipoArchivo.MUSICA],
    ['audio/x-m4a', TipoArchivo.MUSICA],
    ['application/pdf', TipoArchivo.DOCUMENTO],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      TipoArchivo.DOCUMENTO,
    ],
    ['text/plain; charset=UTF-8', TipoArchivo.DOCUMENTO],
    ['IMAGE/JPEG', TipoArchivo.IMAGEN],
    ['video/webm', TipoArchivo.VIDEO],
  ])('%s → %s', (mime, tipo) => {
    expect(tipoDesdeMime(mime)).toBe(tipo);
  });

  it.each([
    'application/x-msdownload', // .exe
    'application/octet-stream',
    'text/html',
    'image/svg+xml', // puede llevar scripts
    'application/msword', // .doc antiguo: no está en la lista
    '',
  ])('%p: no permitido', (mime) => {
    expect(tipoDesdeMime(mime)).toBeNull();
  });
});

describe('nombre del archivo', () => {
  it.each([
    ['C:\\fakepath\\cancion.mp3', 'cancion.mp3'],
    ['../../etc/passwd', 'passwd'],
    ['  informe.pdf  ', 'informe.pdf'],
    ['linea\r\nfalsa.txt', 'lineafalsa.txt'],
    ['factura\u202Efdp.exe', 'facturafdp.exe'], // invierte el texto al mostrarlo
    ['nul\u0000.png', 'nul.png'],
    ['..', ''],
    ['carpeta/', ''],
  ])('limpia %p → %p', (entrada, esperado) => {
    expect(limpiarNombreArchivo(entrada)).toBe(esperado);
  });

  it('NFC: la tilde combinada queda precompuesta', () => {
    expect(limpiarNombreArchivo('Me\u0301xico.txt')).toBe('México.txt');
  });

  it('recorta a 255 conservando la extensión', () => {
    const largo = `${'a'.repeat(300)}.mp3`;
    const recortado = recortarNombreArchivo(largo);
    expect(recortado).toHaveLength(NOMBRE_ARCHIVO_MAXIMO);
    expect(recortado.endsWith('.mp3')).toBe(true);
  });

  it('cuenta puntos de código: no parte un emoji', () => {
    const recortado = recortarNombreArchivo('😀'.repeat(300));
    expect(Array.from(recortado)).toHaveLength(NOMBRE_ARCHIVO_MAXIMO);
    expect(recortado).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('al subir, un nombre vacío o ausente queda como "archivo"', () => {
    expect(nombreArchivoSubido(undefined)).toBe('archivo');
    expect(nombreArchivoSubido('/')).toBe('archivo');
    expect(nombreArchivoSubido('foto.png')).toBe('foto.png');
  });
});

describe('SubirArchivoDto', () => {
  it('carpetaId del multipart (texto) se convierte; vacío = raíz', () => {
    expect(validar(SubirArchivoDto, { carpetaId: '3' }).dto.carpetaId).toBe(3);
    const vacio = validar(SubirArchivoDto, { carpetaId: '' });
    expect(vacio.campos).toEqual([]);
    expect(vacio.dto.carpetaId).toBeUndefined();
  });

  it.each(['abc', '0', '-1', '1.5', '3x'])('rechaza carpetaId %p', (valor) => {
    expect(validar(SubirArchivoDto, { carpetaId: valor }).campos).toEqual([
      'carpetaId',
    ]);
  });
});

describe('ListarArchivosQueryDto', () => {
  it('convierte filtros y hereda la paginación', () => {
    const { dto, campos } = validar(ListarArchivosQueryDto, {
      tipo: 'MUSICA',
      carpetaId: '4',
      buscar: '  cancion ',
    });
    expect(campos).toEqual([]);
    expect(dto).toMatchObject({
      tipo: 'MUSICA',
      carpetaId: 4,
      buscar: 'cancion',
      page: 1,
      limit: 20,
    });
  });

  it('rechaza un tipo desconocido', () => {
    expect(
      validar(ListarArchivosQueryDto, { tipo: 'EJECUTABLE' }).campos,
    ).toEqual(['tipo']);
  });
});

describe('ActualizarArchivoDto', () => {
  it('limpia el nombre y acepta mover a la raíz con null', () => {
    const { dto, campos } = validar(ActualizarArchivoDto, {
      nombreOriginal: ' ../nuevo.pdf ',
      carpetaId: null,
    });
    expect(campos).toEqual([]);
    expect(dto.nombreOriginal).toBe('nuevo.pdf');
    expect(dto.carpetaId).toBeNull();
  });

  it.each([
    ['vacío', ''],
    ['solo una ruta', 'a/b/'],
    ['null', null],
    ['más de 255', `${'x'.repeat(256)}`],
  ])('rechaza nombreOriginal %s', (_caso, valor) => {
    expect(
      validar(ActualizarArchivoDto, { nombreOriginal: valor }).campos,
    ).toEqual(['nombreOriginal']);
  });
});
