import { ApiProperty } from '@nestjs/swagger';

export class ClienteRespuestaDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '12345678' })
  nit!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  nombre!: string;

  @ApiProperty({ type: String, nullable: true, example: 'juan@correo.com' })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  telefono!: string | null;

  @ApiProperty({ type: String, nullable: true })
  direccion!: string | null;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: Date;
}

export class ClientesPaginadosDto {
  @ApiProperty({ type: [ClienteRespuestaDto] })
  data!: ClienteRespuestaDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
