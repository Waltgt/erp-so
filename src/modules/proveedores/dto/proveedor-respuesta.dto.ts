import { ApiProperty } from '@nestjs/swagger';

export class ProveedorRespuestaDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '12345678' })
  nit!: string;

  @ApiProperty({ example: 'Distribuidora El Sol, S.A.' })
  nombre!: string;

  @ApiProperty({ type: String, nullable: true, example: 'María Gómez' })
  contacto!: string | null;

  @ApiProperty({ type: String, nullable: true })
  telefono!: string | null;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  direccion!: string | null;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: Date;
}

// GET, GET /:id y DELETE: incluyen cuántos productos activos tiene asociados
export class ProveedorDetalleDto extends ProveedorRespuestaDto {
  @ApiProperty({
    example: 3,
    description: 'Productos activos asociados a este proveedor',
  })
  productosActivos!: number;
}

export class ProveedoresPaginadosDto {
  @ApiProperty({ type: [ProveedorDetalleDto] })
  data!: ProveedorDetalleDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
