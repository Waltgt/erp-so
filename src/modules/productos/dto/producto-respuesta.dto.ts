import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Dinero sale como string (Decimal). `costo` NO viene para VENDEDOR.
export class ProductoRespuestaDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'LAP-001' })
  sku!: string;

  @ApiProperty({ example: 'Laptop 14"' })
  nombre!: string;

  @ApiProperty({ type: String, nullable: true })
  descripcion!: string | null;

  @ApiProperty({ type: String, example: '5999.99' })
  precioVenta!: string;

  @ApiPropertyOptional({
    type: String,
    example: '4500.00',
    description: 'Información interna: NO se incluye para VENDEDOR',
  })
  costo?: string;

  @ApiProperty({ example: 12 })
  stock!: number;

  @ApiProperty({ example: 5 })
  stockMinimo!: number;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  proveedorId!: number | null;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: Date;
}

export class ProductosPaginadosDto {
  @ApiProperty({ type: [ProductoRespuestaDto] })
  data!: ProductoRespuestaDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
