import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { CANTIDAD_MAXIMA } from './campos-producto';

export class AjusteStockDto {
  @ApiProperty({
    example: -3,
    description: 'Positivo suma, negativo resta. Distinto de 0',
    minimum: -CANTIDAD_MAXIMA,
    maximum: CANTIDAD_MAXIMA,
  })
  @IsInt()
  @NotEquals(0, { message: 'cantidad debe ser distinta de 0' })
  @Min(-CANTIDAD_MAXIMA)
  @Max(CANTIDAD_MAXIMA)
  cantidad!: number;

  // No se guarda en la base (no hay tabla de ajustes): va al log de la app
  @ApiProperty({ example: 'Conteo físico: 3 unidades dañadas' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo!: string;
}
