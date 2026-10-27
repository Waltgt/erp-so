import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_MIN = 10;
// Límite superior para no hashear strings enormes (cada hash argon2 cuesta CPU)
export const PASSWORD_MAX = 128;

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Email: trim + minúsculas ANTES de validar, guardar o buscar en el login
export function IsEmailNormalizado(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'ana@empresa.com', maxLength: 150 }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: 'email debe ser un correo válido' }),
    MaxLength(150),
  );
}

// Contraseña nueva (crear, cambiar, restablecer): mínimo 10 caracteres.
// No se recorta: los espacios son parte de la contraseña.
export function IsPasswordNueva(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX }),
    IsString(),
    MinLength(PASSWORD_MIN, {
      message: `$property debe tener al menos ${PASSWORD_MIN} caracteres`,
    }),
    MaxLength(PASSWORD_MAX),
  );
}

// Nombre visible del usuario (VarChar(100))
export function IsNombreUsuario({ opcional = false } = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'Ana López', maxLength: 100, required: !opcional }),
    Transform(recortar),
    IsString(),
    IsNotEmpty(),
    MaxLength(100),
  );
}
