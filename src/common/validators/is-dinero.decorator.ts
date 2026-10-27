import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

// Monto no negativo con máximo 2 decimales y que cabe en Decimal(12,2)
// (hasta 10 dígitos enteros).
const PATRON_DINERO = /^\d{1,10}(\.\d{1,2})?$/;

// Dinero en un DTO: acepta string ("12.50") o number (12.5) y lo deja
// como string. El servicio lo convierte con new Prisma.Decimal(valor);
// nunca se hacen cálculos con number de JS.
export function IsDinero(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: String, example: '12.50' }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' ? String(value) : value,
    ),
    IsString({ message: '$property debe ser un monto (string o number)' }),
    Matches(PATRON_DINERO, {
      message: '$property debe ser un monto no negativo con máximo 2 decimales',
    }),
  );
}
