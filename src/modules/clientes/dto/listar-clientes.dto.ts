import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ListadoQueryDto } from '../../../common/dto/paginacion.dto';

export class ListarClientesQueryDto extends ListadoQueryDto {
  @ApiPropertyOptional({
    description:
      'Busca en nombre o NIT, sin distinguir mayúsculas (no ignora tildes)',
    example: 'perez',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  buscar?: string;
}
