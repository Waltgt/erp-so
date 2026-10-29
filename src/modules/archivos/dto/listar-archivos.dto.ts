import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/dto/paginacion.dto';
import { TipoArchivo } from '../../../generated/prisma/client';
import { IsBuscar, IsCarpetaIdOpcional } from './campos-archivo';

export class ListarArchivosQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: TipoArchivo })
  @IsOptional()
  @IsEnum(TipoArchivo)
  tipo?: TipoArchivo;

  @IsCarpetaIdOpcional('Solo los archivos de esa carpeta. Ausente = todas')
  carpetaId?: number;

  @IsBuscar(
    'Texto en el nombre original, sin distinguir mayúsculas (no ignora tildes)',
  )
  buscar?: string;

  // Que solo ADMIN lo use se valida en el servicio (otro rol: 403)
  @ApiPropertyOptional({
    example: 2,
    description: 'Solo ADMIN: los archivos de ese usuario',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId?: number;
}
