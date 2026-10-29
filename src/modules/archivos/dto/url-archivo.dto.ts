import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum ModoUrl {
  // inline: el navegador lo muestra o lo reproduce (<img>, <audio>, <video>)
  Ver = 'ver',
  // attachment: lo descarga con el nombre original
  Descargar = 'descargar',
}

// GET /archivos/:id/url?modo=ver|descargar
export class UrlArchivoQueryDto {
  @ApiPropertyOptional({ enum: ModoUrl, default: ModoUrl.Ver })
  @IsOptional()
  @IsEnum(ModoUrl)
  modo: ModoUrl = ModoUrl.Ver;
}

export class UrlFirmadaDto {
  @ApiProperty({
    example:
      'http://192.168.56.10:3900/erp-archivos/3f1c...?X-Amz-Algorithm=AWS4-HMAC-SHA256&...',
    description:
      'URL firmada de Garage (a través de Nginx). Solo sirve para leer ese ' +
      'archivo (GET/HEAD, admite Range) hasta expiraEn.',
  })
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiraEn!: Date;
}
