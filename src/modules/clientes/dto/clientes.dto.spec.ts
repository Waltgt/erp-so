import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActualizarClienteDto } from './actualizar-cliente.dto';
import { normalizarNit } from './campos-cliente';
import { CrearClienteDto } from './crear-cliente.dto';
import { ListarClientesQueryDto } from './listar-clientes.dto';

function validar<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('normalizarNit', () => {
  it.each([
    [' 1234567-8 ', '12345678'],
    ['12345678', '12345678'],
    ['1234 567-k', '1234567K'],
    ['cf', 'CF'],
    [' C F ', 'CF'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(normalizarNit(entrada)).toBe(esperado);
  });

  it('"1234567-8" y "12345678" quedan iguales (criterio de aceptación)', () => {
    expect(normalizarNit('1234567-8')).toBe(normalizarNit('12345678'));
  });
});

describe('CrearClienteDto', () => {
  const valido = { nit: '1234567-8', nombre: 'Juan Pérez' };

  it('acepta solo nit y nombre, y normaliza el NIT', () => {
    const { dto, campos } = validar(CrearClienteDto, valido);
    expect(campos).toEqual([]);
    expect(dto.nit).toBe('12345678');
  });

  it('acepta CF', () => {
    const { dto, campos } = validar(CrearClienteDto, { ...valido, nit: 'cf' });
    expect(campos).toEqual([]);
    expect(dto.nit).toBe('CF');
  });

  it('email: trim + minúsculas', () => {
    const { dto, campos } = validar(CrearClienteDto, {
      ...valido,
      email: '  Juan@Correo.COM ',
    });
    expect(campos).toEqual([]);
    expect(dto.email).toBe('juan@correo.com');
  });

  it('campos opcionales vacíos se vuelven null', () => {
    const { dto, campos } = validar(CrearClienteDto, {
      ...valido,
      email: '  ',
      telefono: '',
      direccion: ' ',
    });
    expect(campos).toEqual([]);
    expect(dto).toMatchObject({ email: null, telefono: null, direccion: null });
  });

  it.each([
    ['NIT con letras', { nit: 'ABC123' }, 'nit'],
    ['NIT de un dígito', { nit: '5' }, 'nit'],
    ['NIT con K en medio', { nit: '12K45' }, 'nit'],
    ['NIT de más de 20', { nit: '1'.repeat(21) }, 'nit'],
    ['sin NIT', { nit: undefined }, 'nit'],
    ['nombre vacío', { nombre: '  ' }, 'nombre'],
    ['nombre de más de 150', { nombre: 'x'.repeat(151) }, 'nombre'],
    ['email inválido', { email: 'no-es-email' }, 'email'],
    ['teléfono con letras', { telefono: 'llamar luego' }, 'telefono'],
    ['dirección de más de 255', { direccion: 'x'.repeat(256) }, 'direccion'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(validar(CrearClienteDto, { ...valido, ...cambio }).campos).toContain(
      campo,
    );
  });
});

describe('ActualizarClienteDto', () => {
  it('todo es opcional', () => {
    expect(validar(ActualizarClienteDto, {}).campos).toEqual([]);
  });

  it('null en email/telefono/direccion es válido (borra el valor)', () => {
    expect(
      validar(ActualizarClienteDto, {
        email: null,
        telefono: null,
        direccion: null,
      }).campos,
    ).toEqual([]);
  });

  it.each(['nit', 'nombre'])('rechaza %s: null (columna NOT NULL)', (campo) => {
    expect(validar(ActualizarClienteDto, { [campo]: null }).campos).toEqual([
      campo,
    ]);
  });

  it('normaliza el NIT también al editar', () => {
    expect(validar(ActualizarClienteDto, { nit: '9876-5' }).dto.nit).toBe(
      '98765',
    );
  });
});

describe('ListarClientesQueryDto', () => {
  it('recorta buscar y lo descarta si queda vacío', () => {
    expect(
      validar(ListarClientesQueryDto, { buscar: ' perez ' }).dto.buscar,
    ).toBe('perez');
    expect(
      validar(ListarClientesQueryDto, { buscar: '   ' }).dto.buscar,
    ).toBeUndefined();
  });

  it('hereda la paginación', () => {
    expect(validar(ListarClientesQueryDto, { limit: '101' }).campos).toContain(
      'limit',
    );
  });
});
