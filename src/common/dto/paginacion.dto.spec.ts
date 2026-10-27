import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ListadoQueryDto,
  PaginacionQueryDto,
  paginacionPrisma,
  respuestaPaginada,
} from './paginacion.dto';

function validar<T extends object>(cls: new () => T, query: object) {
  const dto = plainToInstance(cls, query);
  return { dto, errores: validateSync(dto) };
}

describe('PaginacionQueryDto', () => {
  it('usa page=1 y limit=20 por defecto', () => {
    const { dto, errores } = validar(PaginacionQueryDto, {});
    expect(errores).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });

  it('convierte los strings de la query a número', () => {
    const { dto, errores } = validar(PaginacionQueryDto, {
      page: '3',
      limit: '50',
    });
    expect(errores).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 50 });
  });

  it.each([
    ['limit mayor a 100', { limit: '101' }],
    ['limit 0', { limit: '0' }],
    ['page 0', { page: '0' }],
    ['page no numérico', { page: 'abc' }],
    ['page decimal', { page: '1.5' }],
  ])('rechaza %s', (_caso, query) => {
    expect(validar(PaginacionQueryDto, query).errores).not.toHaveLength(0);
  });
});

describe('ListadoQueryDto', () => {
  it('incluirInactivos es false por defecto', () => {
    expect(validar(ListadoQueryDto, {}).dto.incluirInactivos).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('convierte "%s" a %s', (valor, esperado) => {
    const { dto, errores } = validar(ListadoQueryDto, {
      incluirInactivos: valor,
    });
    expect(errores).toHaveLength(0);
    expect(dto.incluirInactivos).toBe(esperado);
  });

  it('rechaza un valor que no es booleano', () => {
    expect(
      validar(ListadoQueryDto, { incluirInactivos: 'si' }).errores,
    ).not.toHaveLength(0);
  });
});

describe('helpers de paginación', () => {
  it('paginacionPrisma calcula skip y take', () => {
    expect(paginacionPrisma({ page: 3, limit: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });

  it('respuestaPaginada arma { data, total, page, limit }', () => {
    expect(respuestaPaginada(['a'], 41, { page: 3, limit: 20 })).toEqual({
      data: ['a'],
      total: 41,
      page: 3,
      limit: 20,
    });
  });
});
