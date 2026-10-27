import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  IsDireccion,
  IsEmailContacto,
  IsNit,
  IsNombreEntidad,
  IsTelefono,
  IsTextoOpcional,
} from '../../../common/validators/campos-contacto';
import { SiViene } from '../../../common/validators/si-viene';

// Todos opcionales; contacto/telefono/email/direccion aceptan null para
// borrarlos. nit y nombre no aceptan null (NOT NULL).
export class ActualizarProveedorDto {
  @SiViene()
  @IsNit({ permitirCF: false })
  nit?: string;

  @SiViene()
  @IsNombreEntidad({ opcional: true, ejemplo: 'Distribuidora El Sol, S.A.' })
  nombre?: string;

  @IsTextoOpcional(100, 'María Gómez')
  contacto?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsEmailContacto()
  email?: string | null;

  @IsDireccion()
  direccion?: string | null;

  // Los mismos roles que pueden borrar (ADMIN, COMPRAS) pueden reactivar
  @ApiPropertyOptional({
    description: 'true reactiva el proveedor, false lo desactiva',
  })
  @SiViene()
  @IsBoolean()
  activo?: boolean;
}
