import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActualizarProveedorDto } from './actualizar-proveedor.dto';
import { CrearProveedorDto } from './crear-proveedor.dto';

function validar<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  const errores = validateSync(dto);
  return {
    dto,
    campos: errores.map((e) => e.property),
    mensajes: errores.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe('CrearProveedorDto', () => {
  const valido = { nit: '1234567-8', nombre: 'Distribuidora El Sol' };

  it('acepta un proveedor válido y normaliza el NIT', () => {
    const { dto, campos } = validar(CrearProveedorDto, valido);
    expect(campos).toEqual([]);
    expect(dto.nit).toBe('12345678');
  });

  it.each(['CF', 'cf', ' C-F '])(
    'rechaza el NIT "%s" (criterio: 400)',
    (nit) => {
      const { campos, mensajes } = validar(CrearProveedorDto, {
        ...valido,
        nit,
      });
      expect(campos).toEqual(['nit']);
      expect(mensajes.join()).toMatch(/"CF"/);
    },
  );

  it('acepta contacto y lo recorta; vacío → null', () => {
    expect(
      validar(CrearProveedorDto, { ...valido, contacto: ' María ' }).dto
        .contacto,
    ).toBe('María');
    expect(
      validar(CrearProveedorDto, { ...valido, contacto: '  ' }).dto.contacto,
    ).toBeNull();
  });

  it.each([
    ['contacto de más de 100', { contacto: 'x'.repeat(101) }, 'contacto'],
    ['email inválido', { email: 'malo' }, 'email'],
    ['nombre vacío', { nombre: ' ' }, 'nombre'],
    ['NIT inválido', { nit: 'ABC' }, 'nit'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(
      validar(CrearProveedorDto, { ...valido, ...cambio }).campos,
    ).toContain(campo);
  });
});

describe('ActualizarProveedorDto', () => {
  it('todo es opcional', () => {
    expect(validar(ActualizarProveedorDto, {}).campos).toEqual([]);
  });

  it('también rechaza CF al editar', () => {
    expect(validar(ActualizarProveedorDto, { nit: 'CF' }).campos).toEqual([
      'nit',
    ]);
  });

  it.each(['nit', 'nombre', 'activo'])('rechaza %s: null', (campo) => {
    expect(validar(ActualizarProveedorDto, { [campo]: null }).campos).toEqual([
      campo,
    ]);
  });

  it('null en contacto/telefono/email/direccion borra el valor', () => {
    expect(
      validar(ActualizarProveedorDto, {
        contacto: null,
        telefono: null,
        email: null,
        direccion: null,
      }).campos,
    ).toEqual([]);
  });

  it('activo acepta booleanos', () => {
    expect(validar(ActualizarProveedorDto, { activo: true }).campos).toEqual(
      [],
    );
  });
});
