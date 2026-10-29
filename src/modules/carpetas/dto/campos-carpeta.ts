import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  NotEquals,
} from 'class-validator';

// carpetas.nombre es VarChar(100)
export const NOMBRE_CARPETA_MAXIMO = 100;

// Sin / ni \ (parecerían rutas) ni caracteres de control o de formato
const PATRON_NOMBRE_CARPETA = /^[^/\\\p{Cc}\p{Cf}]+$/u;

// trim + NFC: "Música" escrito con tilde combinada y con tilde precompuesta
// es el mismo nombre (el índice carpetas_nombre_unico compara bytes).
// Mayúsculas y minúsculas sí se distinguen ("Fotos" ≠ "fotos").
export function IsNombreCarpeta({ opcional = false } = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'Facturas 2026',
      maxLength: NOMBRE_CARPETA_MAXIMO,
      required: !opcional,
      description: 'Único entre las carpetas del mismo nivel. Sin / ni \\',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.normalize('NFC').trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
    MaxLength(NOMBRE_CARPETA_MAXIMO),
    Matches(PATRON_NOMBRE_CARPETA, {
      message: 'nombre no puede tener / ni \\ ni caracteres de control',
    }),
    NotEquals('.', { message: 'nombre no puede ser "."' }),
    NotEquals('..', { message: 'nombre no puede ser ".."' }),
  );
}
