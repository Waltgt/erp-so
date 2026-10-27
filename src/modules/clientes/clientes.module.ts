import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService],
  // Ventas (módulo 05) lo usará para validar que el cliente esté activo
  exports: [ClientesService],
})
export class ClientesModule {}
