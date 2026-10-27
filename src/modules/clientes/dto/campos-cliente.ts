import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const NIT_CONSUMIDOR_FINAL = 'CF';

// trim, mayúsculas, sin espacios ni guiones: " 1234567-8 " → "12345678",
// "cf" → "CF". Se usa al guardar Y al buscar, para que coincidan.
export function normalizarNit(valor: string): string {
  return valor.trim().toUpperCase().replace(/[\s-]/g, '');
}

// NIT guatemalteco ya normalizado: dígitos + dígito verificador (0-9 o K),
// o "CF". No se valida el dígito verificador.
const PATRON_NIT = /^(CF|\d{1,19}[0-9K])$/;

export function IsNit(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: '1234567-8',
      description:
        'Se normaliza: sin espacios ni guiones, en mayúsculas. "CF" = consumidor final',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizarNit(value) : value,
    ),
    IsString(),
    Matches(PATRON_NIT, {
      message: 'nit debe ser "CF" o dígitos con dígito verificador (0-9 o K)',
    }),
    MaxLength(20),
  );
}

export function IsNombreCliente({ opcional = false } = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'Juan Pérez', maxLength: 150, required: !opcional }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
    MaxLength(150),
  );
}

// Campos de texto opcionales: un string vacío (o solo espacios) se guarda
// como null, y null borra el valor en un PATCH.
const vacioANull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const recortado = value.trim();
  return recortado === '' ? null : recortado;
};

export function IsEmailCliente(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'juan@correo.com',
      nullable: true,
      maxLength: 150,
    }),
    Transform(({ value }: { value: unknown }) => {
      const v = vacioANull({ value });
      return typeof v === 'string' ? v.toLowerCase() : v;
    }),
    IsOptional(),
    IsEmail({}, { message: 'email debe ser un correo válido' }),
    MaxLength(150),
  );
}

export function IsTelefono(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ example: '+502 5555-1234', nullable: true }),
    Transform(vacioANull),
    IsOptional(),
    IsString(),
    Matches(/^\+?[0-9\s()-]{6,20}$/, {
      message: 'telefono solo admite dígitos, espacios, +, - y paréntesis',
    }),
    MaxLength(20),
  );
}

export function IsDireccion(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ example: 'Zona 1, Guatemala', nullable: true }),
    Transform(vacioANull),
    IsOptional(),
    IsString(),
    MaxLength(255),
  );
}
