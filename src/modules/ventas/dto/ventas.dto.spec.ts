import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { AnularVentaDto } from './anular-venta.dto';
import { CrearVentaDto } from './crear-venta.dto';
import { ListarVentasQueryDto } from './listar-ventas.dto';

// Incluye los errores de objetos anidados (items[0].cantidad → "items")
function validar<T extends object>(
  cls: new () => T,
  body: object,
  opciones = {},
) {
  const dto = plainToInstance(cls, body);
  const errores = validateSync(dto, opciones);
  const mensajes = (es: ValidationError[]): string[] =>
    es.flatMap((e) => [
      ...Object.values(e.constraints ?? {}),
      ...mensajes(e.children ?? []),
    ]);
  return {
    dto,
    campos: errores.map((e) => e.property),
    mensajes: mensajes(errores),
  };
}

describe('CrearVentaDto', () => {
  const valido = {
    clienteId: 1,
    items: [
      { productoId: 3, cantidad: 2 },
      { productoId: 1, cantidad: 1 },
    ],
  };

  it('acepta una venta válida', () => {
    expect(validar(CrearVentaDto, valido).campos).toEqual([]);
  });

  it.each([
    ['sin items', { items: [] }],
    [
      '51 items',
      {
        items: Array.from({ length: 51 }, (_, i) => ({
          productoId: i + 1,
          cantidad: 1,
        })),
      },
    ],
    ['items no es arreglo', { items: { productoId: 1, cantidad: 1 } }],
    ['cantidad 0', { items: [{ productoId: 1, cantidad: 0 }] }],
    ['cantidad decimal', { items: [{ productoId: 1, cantidad: 1.5 }] }],
    ['cantidad negativa', { items: [{ productoId: 1, cantidad: -2 }] }],
    ['productoId inválido', { items: [{ productoId: 'x', cantidad: 1 }] }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(validar(CrearVentaDto, { ...valido, ...cambio }).campos).toContain(
      'items',
    );
  });

  it('rechaza productoId repetidos (no los suma en silencio)', () => {
    const { campos, mensajes } = validar(CrearVentaDto, {
      clienteId: 1,
      items: [
        { productoId: 1, cantidad: 1 },
        { productoId: 1, cantidad: 2 },
      ],
    });
    expect(campos).toEqual(['items']);
    expect(mensajes).toContain('items no puede repetir productoId');
  });

  it('acepta exactamente 50 items distintos', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      productoId: i + 1,
      cantidad: 1,
    }));
    expect(validar(CrearVentaDto, { clienteId: 1, items }).campos).toEqual([]);
  });

  it('precioUnitario en un item: no permitido (con las opciones del ValidationPipe)', () => {
    const { campos, mensajes } = validar(
      CrearVentaDto,
      {
        clienteId: 1,
        items: [{ productoId: 1, cantidad: 1, precioUnitario: '0.01' }],
      },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(campos).toEqual(['items']);
    expect(mensajes).toContain('property precioUnitario should not exist');
  });

  it('rechaza clienteId ausente o 0', () => {
    expect(validar(CrearVentaDto, { items: valido.items }).campos).toEqual([
      'clienteId',
    ]);
    expect(validar(CrearVentaDto, { ...valido, clienteId: 0 }).campos).toEqual([
      'clienteId',
    ]);
  });
});

describe('ListarVentasQueryDto', () => {
  it('fecha sin hora: desde = inicio del día y hasta = fin del día en Guatemala (UTC-6)', () => {
    const { dto, campos } = validar(ListarVentasQueryDto, {
      desde: '2026-10-26',
      hasta: '2026-10-26',
    });
    expect(campos).toEqual([]);
    expect(dto.desde?.toISOString()).toBe('2026-10-26T06:00:00.000Z');
    expect(dto.hasta?.toISOString()).toBe('2026-10-27T05:59:59.999Z');
  });

  it('acepta fecha y hora ISO con zona', () => {
    const { dto, campos } = validar(ListarVentasQueryDto, {
      desde: '2026-10-26T15:30:00-06:00',
      hasta: '2026-10-26T23:00:00Z',
    });
    expect(campos).toEqual([]);
    expect(dto.desde?.toISOString()).toBe('2026-10-26T21:30:00.000Z');
  });

  it.each([
    ['fecha y hora sin zona (ambigua)', '2026-10-26T15:30:00'],
    ['día inexistente', '2026-02-30'],
    ['mes 13', '2026-13-01'],
    ['texto', 'ayer'],
    ['formato local', '26/10/2026'],
  ])('rechaza %s', (_caso, valor) => {
    expect(validar(ListarVentasQueryDto, { desde: valor }).campos).toEqual([
      'desde',
    ]);
  });

  it('convierte clienteId y valida estado', () => {
    const { dto, campos } = validar(ListarVentasQueryDto, {
      clienteId: '4',
      estado: 'ANULADA',
    });
    expect(campos).toEqual([]);
    expect(dto.clienteId).toBe(4);
    expect(
      validar(ListarVentasQueryDto, { estado: 'PENDIENTE' }).campos,
    ).toEqual(['estado']);
  });

  it('hereda la paginación', () => {
    expect(validar(ListarVentasQueryDto, {}).dto).toMatchObject({
      page: 1,
      limit: 20,
    });
  });
});

describe('AnularVentaDto', () => {
  it('motivo de 5 a 255 caracteres, recortado', () => {
    expect(
      validar(AnularVentaDto, { motivo: '  Devolución  ' }).dto.motivo,
    ).toBe('Devolución');
    expect(validar(AnularVentaDto, { motivo: 'abcd' }).campos).toEqual([
      'motivo',
    ]);
    expect(validar(AnularVentaDto, { motivo: '    ' }).campos).toEqual([
      'motivo',
    ]);
    expect(validar(AnularVentaDto, { motivo: 'x'.repeat(256) }).campos).toEqual(
      ['motivo'],
    );
  });
});
