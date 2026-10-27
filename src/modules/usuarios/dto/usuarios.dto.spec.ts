import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from '../../auth/dto/login.dto';
import { CambiarPasswordDto } from '../../auth/dto/cambiar-password.dto';
import { ActualizarUsuarioDto } from './actualizar-usuario.dto';
import { CrearUsuarioDto } from './crear-usuario.dto';
import { RestablecerPasswordDto } from './restablecer-password.dto';

function validar<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  const errores = validateSync(dto);
  return { dto, campos: errores.map((e) => e.property) };
}

const valido = {
  nombre: 'Ana López',
  email: 'ana@empresa.com',
  password: 'contraseña-larga',
  rol: 'VENDEDOR',
};

describe('CrearUsuarioDto', () => {
  it('acepta un usuario válido', () => {
    expect(validar(CrearUsuarioDto, valido).campos).toEqual([]);
  });

  it('normaliza el email con trim y minúsculas', () => {
    const { dto, campos } = validar(CrearUsuarioDto, {
      ...valido,
      email: '  Ana@Empresa.COM ',
    });
    expect(campos).toEqual([]);
    expect(dto.email).toBe('ana@empresa.com');
  });

  it('recorta el nombre', () => {
    const { dto } = validar(CrearUsuarioDto, {
      ...valido,
      nombre: '  Ana  ',
    });
    expect(dto.nombre).toBe('Ana');
  });

  it('no recorta la contraseña', () => {
    const { dto } = validar(CrearUsuarioDto, {
      ...valido,
      password: '  con espacios  ',
    });
    expect(dto.password).toBe('  con espacios  ');
  });

  it.each([
    ['contraseña de 9 caracteres', { password: '123456789' }, 'password'],
    ['contraseña de más de 128', { password: 'x'.repeat(129) }, 'password'],
    ['email inválido', { email: 'no-es-email' }, 'email'],
    ['rol inexistente', { rol: 'SUPERADMIN' }, 'rol'],
    ['nombre vacío', { nombre: '   ' }, 'nombre'],
    ['nombre de más de 100', { nombre: 'x'.repeat(101) }, 'nombre'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(validar(CrearUsuarioDto, { ...valido, ...cambio }).campos).toContain(
      campo,
    );
  });

  it('acepta exactamente 10 caracteres de contraseña', () => {
    expect(
      validar(CrearUsuarioDto, { ...valido, password: '1234567890' }).campos,
    ).toEqual([]);
  });
});

describe('ActualizarUsuarioDto', () => {
  it('todos los campos son opcionales', () => {
    expect(validar(ActualizarUsuarioDto, {}).campos).toEqual([]);
  });

  it('acepta nombre, rol y activo', () => {
    expect(
      validar(ActualizarUsuarioDto, {
        nombre: 'Otro',
        rol: 'ADMIN',
        activo: false,
      }).campos,
    ).toEqual([]);
  });

  it('activo debe ser booleano real, no el string "false"', () => {
    expect(validar(ActualizarUsuarioDto, { activo: 'false' }).campos).toEqual([
      'activo',
    ]);
  });
});

describe('RestablecerPasswordDto', () => {
  it('exige mínimo 10 caracteres', () => {
    expect(
      validar(RestablecerPasswordDto, { password: 'corta' }).campos,
    ).toEqual(['password']);
  });
});

describe('LoginDto', () => {
  it('normaliza el email', () => {
    const { dto, campos } = validar(LoginDto, {
      email: ' ADMIN@Empresa.com',
      password: 'x',
    });
    expect(campos).toEqual([]);
    expect(dto.email).toBe('admin@empresa.com');
  });

  it('no exige mínimo de 10 en la contraseña (para responder el mismo 401)', () => {
    expect(
      validar(LoginDto, { email: 'a@b.com', password: 'corta' }).campos,
    ).toEqual([]);
  });

  it('rechaza contraseña vacía', () => {
    expect(
      validar(LoginDto, { email: 'a@b.com', password: '' }).campos,
    ).toEqual(['password']);
  });
});

describe('CambiarPasswordDto', () => {
  it('exige la actual y una nueva de al menos 10', () => {
    expect(
      validar(CambiarPasswordDto, {
        passwordActual: 'vieja',
        passwordNueva: 'corta',
      }).campos,
    ).toEqual(['passwordNueva']);
  });
});
