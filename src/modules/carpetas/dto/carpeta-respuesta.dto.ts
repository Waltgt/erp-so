import { ApiProperty } from '@nestjs/swagger';
import { ArchivoRespuestaDto } from '../../archivos/dto/archivo-respuesta.dto';

export class CarpetaRespuestaDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Facturas 2026' })
  nombre!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'null = raíz' })
  parentId!: number | null;

  @ApiProperty({ example: 2, description: 'Dueño' })
  usuarioId!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}

// Un nivel del árbol: la carpeta abierta (null en la raíz), sus subcarpetas
// y sus archivos
export class ContenidoCarpetaDto {
  @ApiProperty({ type: CarpetaRespuestaDto, nullable: true })
  carpeta!: CarpetaRespuestaDto | null;

  @ApiProperty({ type: [CarpetaRespuestaDto] })
  carpetas!: CarpetaRespuestaDto[];

  @ApiProperty({ type: [ArchivoRespuestaDto] })
  archivos!: ArchivoRespuestaDto[];
}
