import { ApiProperty } from '@nestjs/swagger';
import { TipoArchivo } from '../../../generated/prisma/client';

// Sin objectKey: es un detalle interno del almacenamiento. Se descarga con
// GET /archivos/:id/descarga, que verifica el permiso.
export class ArchivoRespuestaDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'cancion.mp3', description: 'Solo para mostrar' })
  nombreOriginal!: string;

  @ApiProperty({ example: 'audio/mpeg' })
  mimeType!: string;

  @ApiProperty({ example: 4194304 })
  tamanoBytes!: number;

  @ApiProperty({ enum: TipoArchivo })
  tipo!: TipoArchivo;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'No se calcula por ahora (siempre null)',
  })
  duracionSeg!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'null = raíz' })
  carpetaId!: number | null;

  @ApiProperty({ example: 2, description: 'Dueño' })
  usuarioId!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}

export class ArchivosPaginadosDto {
  @ApiProperty({ type: [ArchivoRespuestaDto] })
  data!: ArchivoRespuestaDto[];

  @ApiProperty({ example: 41 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
