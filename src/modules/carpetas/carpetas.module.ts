import { Module } from '@nestjs/common';
import { CarpetasController } from './carpetas.controller';
import { CarpetasService } from './carpetas.service';

@Module({
  controllers: [CarpetasController],
  providers: [CarpetasService],
  exports: [CarpetasService],
})
export class CarpetasModule {}
