import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const LIMITE_MAXIMO = 100;

// ?page=1&limit=20 — base de todos los listados
export class PaginacionQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: LIMITE_MAXIMO, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit: number = 20;
}

// Listados de entidades con borrado lógico. Que solo ADMIN pueda usar
// incluirInactivos se valida en cada módulo (depende de la autenticación).
export class ListadoQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Incluir registros inactivos (solo ADMIN)',
  })
  @IsOptional()
  // "false" en la query string es un string no vacío: se convierte a mano
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  incluirInactivos: boolean = false;
}

// Listado con ?buscar= (en qué campos busca lo define cada módulo).
// Se recorta; si queda vacío se ignora.
export class ListadoBusquedaQueryDto extends ListadoQueryDto {
  @ApiPropertyOptional({
    description:
      'Texto a buscar, sin distinguir mayúsculas (no ignora tildes). Ver cada endpoint',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  buscar?: string;
}

export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Convierte page/limit en los argumentos de Prisma
export function paginacionPrisma({ page, limit }: PaginacionQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * limit, take: limit };
}

export function respuestaPaginada<T>(
  data: T[],
  total: number,
  { page, limit }: PaginacionQueryDto,
): RespuestaPaginada<T> {
  return { data, total, page, limit };
}
