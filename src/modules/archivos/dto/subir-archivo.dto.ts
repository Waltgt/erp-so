import { ApiProperty } from '@nestjs/swagger';
import { IsCarpetaIdOpcional } from './campos-archivo';

// Campos de texto del multipart/form-data de POST /archivos (los que llegan
// antes del archivo). El archivo NO pasa por el ValidationPipe: se lee en
// stream y va directo al almacenamiento.
//
// IMPORTANTE: carpetaId debe ir ANTES que el archivo en el formulario. Con
// stream el archivo se procesa a medida que llega, y en ese momento ya hay
// que saber en qué carpeta va (FormData y curl -F respetan el orden).
export class SubirArchivoDto {
  @IsCarpetaIdOpcional('Carpeta destino (propia). Ausente o vacío = raíz')
  carpetaId?: number;
}

// Solo para Swagger (@ApiBody). Va en una clase aparte porque, con
// useDefineForClassFields, toda instancia tendría la propiedad `archivo` y
// forbidNonWhitelisted rechazaría los campos con 400.
export class SubirArchivoSwaggerDto extends SubirArchivoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'mp3, ogg, wav, flac, m4a, pdf, docx, xlsx, txt, png, jpg, webp, mp4, webm',
  })
  archivo!: unknown;
}
