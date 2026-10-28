import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [ClientesModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
