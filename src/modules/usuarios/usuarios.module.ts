import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, PasswordService],
  exports: [PasswordService],
})
export class UsuariosModule {}
