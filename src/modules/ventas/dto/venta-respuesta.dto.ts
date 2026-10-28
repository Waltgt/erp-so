import { ApiProperty } from '@nestjs/swagger';
import { EstadoVenta } from '../../../generated/prisma/client';

// Dinero sale como string (Decimal)

class ProductoResumenDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'LAP-001' })
  sku!: string;

  @ApiProperty({ example: 'Laptop 14"' })
  nombre!: string;
}

class ClienteResumenDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'CF' })
  nit!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  nombre!: string;
}

class VendedorResumenDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Vera Vendedora' })
  nombre!: string;

  @ApiProperty({ example: 'vera@empresa.com' })
  email!: string;
}

export class DetalleVentaRespuestaDto {
  @ApiProperty({ example: 10 })
  id!: number;

  @ApiProperty({ example: 3 })
  productoId!: number;

  @ApiProperty({ example: 3 })
  cantidad!: number;

  @ApiProperty({
    type: String,
    example: '19.99',
    description: 'Copia del precio al momento de vender',
  })
  precioUnitario!: string;

  @ApiProperty({ type: String, example: '59.97' })
  subtotal!: string;

  @ApiProperty({ type: ProductoResumenDto })
  producto!: ProductoResumenDto;
}

export class VentaRespuestaDto {
  @ApiProperty({ example: 25, description: 'Funciona como correlativo' })
  id!: number;

  @ApiProperty({ example: 1 })
  clienteId!: number;

  @ApiProperty({ example: 2 })
  usuarioId!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  fecha!: Date;

  @ApiProperty({ type: String, example: '59.97' })
  total!: string;

  @ApiProperty({ enum: EstadoVenta })
  estado!: EstadoVenta;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  anuladaEn!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  motivoAnulacion!: string | null;

  @ApiProperty({ type: ClienteResumenDto })
  cliente!: ClienteResumenDto;

  @ApiProperty({ type: VendedorResumenDto })
  usuario!: VendedorResumenDto;
}

// GET /:id, POST y anular: con los detalles
export class VentaDetalleDto extends VentaRespuestaDto {
  @ApiProperty({ type: [DetalleVentaRespuestaDto] })
  detalles!: DetalleVentaRespuestaDto[];
}

export class VentasPaginadasDto {
  @ApiProperty({ type: [VentaRespuestaDto] })
  data!: VentaRespuestaDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
