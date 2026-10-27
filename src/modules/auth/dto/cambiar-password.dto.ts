import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  IsPasswordNueva,
  PASSWORD_MAX,
} from '../../usuarios/dto/campos-usuario';

// El usuario autenticado cambia su propia contraseña: pide la actual
export class CambiarPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX)
  passwordActual!: string;

  @IsPasswordNueva()
  passwordNueva!: string;
}
