import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { SiViene } from '../../../common/validators/si-viene';
import {
  IsDireccion,
  IsEmailContacto,
  IsNit,
  IsNombreEntidad,
  IsTelefono,
} from '../../../common/validators/campos-contacto';

// Todos opcionales; email/telefono/direccion aceptan null para borrarlos.
// activo: solo ADMIN (true reactiva, false equivale a DELETE); otro rol → 403.
export class ActualizarClienteDto {
  @SiViene()
  @IsNit()
  nit?: string;

  @SiViene()
  @IsNombreEntidad({ opcional: true })
  nombre?: string;

  @IsEmailContacto()
  email?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsDireccion()
  direccion?: string | null;

  @ApiPropertyOptional({
    description: 'Solo ADMIN: true reactiva el cliente, false lo desactiva',
  })
  @SiViene()
  @IsBoolean()
  activo?: boolean;
}
