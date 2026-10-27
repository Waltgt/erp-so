import { Module } from '@nestjs/common';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';

@Module({
  controllers: [ProveedoresController],
  providers: [ProveedoresService],
  // Productos (módulo 04) valida que proveedorId sea un proveedor activo
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
