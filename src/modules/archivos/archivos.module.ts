import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module';
import { CarpetasModule } from '../carpetas/carpetas.module';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';

@Module({
  imports: [AlmacenamientoModule, CarpetasModule],
  controllers: [ArchivosController],
  providers: [ArchivosService],
})
export class ArchivosModule {}
