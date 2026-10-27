import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Rol } from '../../../generated/prisma/client';
import {
  IsEmailNormalizado,
  IsNombreUsuario,
  IsPasswordNueva,
} from './campos-usuario';

export class CrearUsuarioDto {
  @IsNombreUsuario()
  nombre!: string;

  @IsEmailNormalizado()
  email!: string;

  @IsPasswordNueva()
  password!: string;

  @ApiProperty({ enum: Rol, example: Rol.VENDEDOR })
  @IsEnum(Rol)
  rol!: Rol;
}
