import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  IsEmailNormalizado,
  PASSWORD_MAX,
} from '../../usuarios/dto/campos-usuario';
import { UsuarioRespuestaDto } from '../../usuarios/dto/usuario-respuesta.dto';

export class LoginDto {
  @IsEmailNormalizado()
  email!: string;

  // Sin mínimo de 10: una contraseña corta debe dar el mismo 401 que una
  // incorrecta, no un 400 que distinga los casos.
  @ApiProperty({ example: 'una-contraseña-segura' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

export class LoginRespuestaDto {
  @ApiProperty({ description: 'JWT para el header Authorization: Bearer' })
  accessToken!: string;

  @ApiProperty({ type: UsuarioRespuestaDto })
  usuario!: UsuarioRespuestaDto;
}
