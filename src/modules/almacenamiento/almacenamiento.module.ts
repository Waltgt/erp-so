import { Module } from '@nestjs/common';
import { Almacenamiento } from './almacenamiento';
import { S3Almacenamiento } from './s3-almacenamiento';

@Module({
  providers: [{ provide: Almacenamiento, useClass: S3Almacenamiento }],
  exports: [Almacenamiento],
})
export class AlmacenamientoModule {}
