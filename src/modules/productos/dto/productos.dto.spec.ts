import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import { ActualizarProductoDto } from './actualizar-producto.dto';
import { AjusteStockDto } from './ajuste-stock.dto';
import { normalizarSku } from './campos-producto';
import { CrearProductoDto } from './crear-producto.dto';
import { ListarProductosQueryDto } from './listar-productos.dto';

function validar<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('normalizarSku', () => {
  it('trim + mayúsculas', () => {
    expect(normalizarSku('  lap-001 ')).toBe('LAP-001');
  });
});

describe('CrearProductoDto', () => {
  const valido = {
    sku: 'lap-001',
    nombre: 'Laptop',
    precioVenta: '5999.99',
    costo: 4500,
  };

  it('acepta un producto válido; normaliza SKU y deja el dinero como string', () => {
    const { dto, campos } = validar(CrearProductoDto, valido);
    expect(campos).toEqual([]);
    expect(dto.sku).toBe('LAP-001');
    expect(dto.costo).toBe('4500');
  });

  it('acepta proveedorId null y descripcion vacía → null', () => {
    const { dto, campos } = validar(CrearProductoDto, {
      ...valido,
      proveedorId: null,
      descripcion: '  ',
    });
    expect(campos).toEqual([]);
    expect(dto.descripcion).toBeNull();
  });

  it.each([
    ['SKU con espacios', { sku: 'LAP 001' }, 'sku'],
    ['SKU de más de 50', { sku: 'A'.repeat(51) }, 'sku'],
    ['precio con 3 decimales', { precioVenta: '10.999' }, 'precioVenta'],
    ['precio negativo', { precioVenta: '-1' }, 'precioVenta'],
    ['sin costo', { costo: undefined }, 'costo'],
    ['stockMinimo negativo', { stockMinimo: -1 }, 'stockMinimo'],
    ['stockMinimo decimal', { stockMinimo: 1.5 }, 'stockMinimo'],
    ['proveedorId 0', { proveedorId: 0 }, 'proveedorId'],
    ['proveedorId texto', { proveedorId: 'uno' }, 'proveedorId'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(
      validar(CrearProductoDto, { ...valido, ...cambio }).campos,
    ).toContain(campo);
  });
});

describe('ActualizarProductoDto', () => {
  it('NO declara `stock` (con forbidNonWhitelisted → 400)', () => {
    const propiedades = getMetadataStorage()
      .getTargetValidationMetadatas(ActualizarProductoDto, '', true, false)
      .map((m) => m.propertyName);
    expect(propiedades).not.toContain('stock');
    expect(propiedades).toEqual(
      expect.arrayContaining(['sku', 'precioVenta', 'activo']),
    );
  });

  it('todo es opcional', () => {
    expect(validar(ActualizarProductoDto, {}).campos).toEqual([]);
  });

  it.each(['sku', 'nombre', 'precioVenta', 'costo', 'stockMinimo', 'activo'])(
    'rechaza %s: null (NOT NULL)',
    (campo) => {
      expect(validar(ActualizarProductoDto, { [campo]: null }).campos).toEqual([
        campo,
      ]);
    },
  );

  it('proveedorId y descripcion sí aceptan null', () => {
    expect(
      validar(ActualizarProductoDto, { proveedorId: null, descripcion: null })
        .campos,
    ).toEqual([]);
  });
});

describe('ListarProductosQueryDto', () => {
  it('convierte proveedorId de la query a número', () => {
    const { dto, campos } = validar(ListarProductosQueryDto, {
      proveedorId: '3',
    });
    expect(campos).toEqual([]);
    expect(dto.proveedorId).toBe(3);
  });

  it('rechaza proveedorId no numérico', () => {
    expect(
      validar(ListarProductosQueryDto, { proveedorId: 'x' }).campos,
    ).toContain('proveedorId');
  });
});

describe('AjusteStockDto', () => {
  it.each([5, -5])('acepta cantidad %d', (cantidad) => {
    expect(
      validar(AjusteStockDto, { cantidad, motivo: 'Conteo físico' }).campos,
    ).toEqual([]);
  });

  it.each([
    ['cantidad 0', { cantidad: 0 }, 'cantidad'],
    ['cantidad decimal', { cantidad: 1.5 }, 'cantidad'],
    ['cantidad enorme', { cantidad: 1_000_001 }, 'cantidad'],
    ['cantidad como texto', { cantidad: '5' }, 'cantidad'],
    ['motivo de 4 caracteres', { motivo: 'abcd' }, 'motivo'],
    ['motivo solo espacios', { motivo: '        ' }, 'motivo'],
    ['motivo de más de 255', { motivo: 'x'.repeat(256) }, 'motivo'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(
      validar(AjusteStockDto, {
        cantidad: -5,
        motivo: 'Conteo físico',
        ...cambio,
      }).campos,
    ).toContain(campo);
  });
});
