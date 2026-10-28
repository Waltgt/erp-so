import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CANTIDAD_MAXIMA } from '../../productos/dto/campos-producto';

export const ITEMS_MAXIMOS = 50;

// Solo productoId y cantidad. NO hay precio: se lee de la base. Con
// forbidNonWhitelisted (que también aplica a objetos anidados validados con
// @ValidateNested), un `precioUnitario` en un item responde 400.
export class ItemVentaDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  productoId!: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: CANTIDAD_MAXIMA })
  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA)
  cantidad!: number;
}

export class CrearVentaDto {
  @ApiProperty({ example: 1, description: 'Debe ser un cliente activo' })
  @IsInt()
  @Min(1)
  clienteId!: number;

  @ApiProperty({
    type: [ItemVentaDto],
    minItems: 1,
    maxItems: ITEMS_MAXIMOS,
    description: 'Sin productoId repetidos',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ITEMS_MAXIMOS)
  // Se rechaza, no se suman en silencio
  @ArrayUnique((item: ItemVentaDto) => item.productoId, {
    message: 'items no puede repetir productoId',
  })
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items!: ItemVentaDto[];
}
