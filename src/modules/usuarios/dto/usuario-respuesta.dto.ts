import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '../../../generated/prisma/client';

// Forma pública de un usuario. NUNCA incluye passwordHash.
export class UsuarioRespuestaDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Ana López' })
  nombre!: string;

  @ApiProperty({ example: 'ana@empresa.com' })
  email!: string;

  @ApiProperty({ enum: Rol })
  rol!: Rol;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: Date;
}

export class UsuariosPaginadosDto {
  @ApiProperty({ type: [UsuarioRespuestaDto] })
  data!: UsuarioRespuestaDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
