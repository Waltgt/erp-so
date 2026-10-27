import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import {
  IsDireccion,
  IsEmailCliente,
  IsNit,
  IsNombreCliente,
  IsTelefono,
} from './campos-cliente';

// Si el campo no viene, no se valida. Si viene null, SÍ se valida (y falla):
// nit y nombre son NOT NULL. @IsOptional() dejaría pasar el null.
const siViene = ValidateIf((_dto, valor) => valor !== undefined);

// Todos opcionales; email/telefono/direccion aceptan null para borrarlos.
// activo: solo ADMIN (true reactiva, false equivale a DELETE); otro rol → 403.
export class ActualizarClienteDto {
  @siViene
  @IsNit()
  nit?: string;

  @siViene
  @IsNombreCliente({ opcional: true })
  nombre?: string;

  @IsEmailCliente()
  email?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsDireccion()
  direccion?: string | null;

  @ApiPropertyOptional({
    description: 'Solo ADMIN: true reactiva el cliente, false lo desactiva',
  })
  @siViene
  @IsBoolean()
  activo?: boolean;
}
