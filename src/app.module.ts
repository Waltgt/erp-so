import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { validarEntorno } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProductosModule } from './modules/productos/productos.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validarEntorno,
    }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    ClientesModule,
    ProveedoresModule,
    ProductosModule,
    VentasModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
