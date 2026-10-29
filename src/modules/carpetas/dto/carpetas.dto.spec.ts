import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActualizarCarpetaDto } from './actualizar-carpeta.dto';
import { CrearCarpetaDto } from './crear-carpeta.dto';
import { ListarContenidoQueryDto } from './listar-contenido.dto';

function validar<T extends object>(
  cls: new () => T,
  body: object,
  opciones = {},
) {
  const dto = plainToInstance(cls, body);
  return {
    dto,
    campos: validateSync(dto, opciones).map((e) => e.property),
  };
}

describe('CrearCarpetaDto', () => {
  it('acepta nombre con espacios alrededor y sin parentId (raíz)', () => {
    const { dto, campos } = validar(CrearCarpetaDto, {
      nombre: '  Facturas 2026 ',
    });
    expect(campos).toEqual([]);
    expect(dto.nombre).toBe('Facturas 2026');
    expect(dto.parentId).toBeUndefined();
  });

  it('acepta parentId null (raíz) y numérico', () => {
    expect(
      validar(CrearCarpetaDto, { nombre: 'A', parentId: null }).campos,
    ).toEqual([]);
    expect(
      validar(CrearCarpetaDto, { nombre: 'A', parentId: 3 }).campos,
    ).toEqual([]);
  });

  it('NFC: la misma palabra escrita de dos formas queda igual', () => {
    // NFD: la "u" y la tilde como dos caracteres separados
    const descompuesto = 'Música'.normalize('NFD');
    expect(descompuesto).not.toBe('Música');
    expect(validar(CrearCarpetaDto, { nombre: descompuesto }).dto.nombre).toBe(
      'Música',
    );
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['con /', 'a/b'],
    ['con \\', 'a\\b'],
    ['con salto de línea', 'a\nb'],
    ['"."', '.'],
    ['".."', '..'],
    ['más de 100', 'x'.repeat(101)],
    ['no es texto', 5],
  ])('rechaza nombre %s', (_caso, nombre) => {
    expect(validar(CrearCarpetaDto, { nombre }).campos).toEqual(['nombre']);
  });

  it('rechaza parentId inválido', () => {
    expect(
      validar(CrearCarpetaDto, { nombre: 'A', parentId: 0 }).campos,
    ).toEqual(['parentId']);
    expect(
      validar(CrearCarpetaDto, { nombre: 'A', parentId: 'x' }).campos,
    ).toEqual(['parentId']);
  });

  it('usuarioId en el body: no permitido (con las opciones del ValidationPipe)', () => {
    expect(
      validar(
        CrearCarpetaDto,
        { nombre: 'A', usuarioId: 1 },
        { whitelist: true, forbidNonWhitelisted: true },
      ).campos,
    ).toEqual(['usuarioId']);
  });
});

describe('ActualizarCarpetaDto', () => {
  it('distingue "no mover" (ausente) de "mover a la raíz" (null)', () => {
    expect(
      validar(ActualizarCarpetaDto, { nombre: 'B' }).dto.parentId,
    ).toBeUndefined();
    const raiz = validar(ActualizarCarpetaDto, { parentId: null });
    expect(raiz.campos).toEqual([]);
    expect(raiz.dto.parentId).toBeNull();
  });

  it('nombre null: 400 (no se puede borrar el nombre)', () => {
    expect(validar(ActualizarCarpetaDto, { nombre: null }).campos).toEqual([
      'nombre',
    ]);
  });
});

describe('ListarContenidoQueryDto', () => {
  it('?parentId=3 → 3; ?parentId= → raíz', () => {
    expect(
      validar(ListarContenidoQueryDto, { parentId: '3' }).dto.parentId,
    ).toBe(3);
    const vacio = validar(ListarContenidoQueryDto, { parentId: '' });
    expect(vacio.campos).toEqual([]);
    expect(vacio.dto.parentId).toBeUndefined();
  });
});
