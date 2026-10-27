import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// trim + mayúsculas: " ab-123 " → "AB-123". Al guardar y al buscar.
export function normalizarSku(valor: string): string {
  return valor.trim().toUpperCase();
}

// Letras, dígitos y separadores - _ . / (sin espacios), hasta 50
const PATRON_SKU = /^[A-Z0-9][A-Z0-9._/-]*$/;

export function IsSku({ opcional = false } = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'LAP-001',
      maxLength: 50,
      required: !opcional,
      description: 'Se guarda en mayúsculas',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizarSku(value) : value,
    ),
    IsString(),
    Matches(PATRON_SKU, {
      message:
        'sku solo admite letras, dígitos y los separadores - _ . / (sin espacios)',
    }),
    MaxLength(50),
  );
}

// Límite superior de cantidades: la columna es INTEGER (máx. ~2.1e9) y así
// un número enorme da 400 y no un error de desbordamiento en la base.
export const CANTIDAD_MAXIMA = 1_000_000;

// stockMinimo (y stock inicial): entero >= 0
export function IsCantidadNoNegativa({
  opcional = false,
  ejemplo = 5,
} = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: ejemplo,
      minimum: 0,
      maximum: CANTIDAD_MAXIMA,
      required: !opcional,
    }),
    IsInt(),
    Min(0),
    Max(CANTIDAD_MAXIMA),
  );
}

// proveedorId: entero positivo; null = sin proveedor
export function IsProveedorId(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      example: 1,
      nullable: true,
      description: 'Debe ser un proveedor activo. null = sin proveedor',
    }),
    IsOptional(),
    IsInt(),
    Min(1),
  );
}

// Para ?proveedorId= en la query string (viene como texto)
export function IsProveedorIdQuery(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ example: 1, description: 'Filtrar por proveedor' }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
  );
}

export function IsDescripcion(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ nullable: true, maxLength: 2000 }),
    Transform(({ value }: { value: unknown }) => {
      if (typeof value !== 'string') {
        return value;
      }
      return value.trim() === '' ? null : value.trim();
    }),
    IsOptional(),
    IsString(),
    MaxLength(2000),
  );
}
