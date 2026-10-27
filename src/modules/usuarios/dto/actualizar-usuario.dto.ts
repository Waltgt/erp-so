import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Rol } from '../../../generated/prisma/client';
import { IsNombreUsuario } from './campos-usuario';

// Solo nombre, rol y activo. El email no se edita y la contraseña tiene
// su propio endpoint (PATCH /usuarios/:id/password).
export class ActualizarUsuarioDto {
  @IsOptional()
  @IsNombreUsuario({ opcional: true })
  nombre?: string;

  @ApiPropertyOptional({ enum: Rol })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
