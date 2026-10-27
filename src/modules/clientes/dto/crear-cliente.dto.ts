import {
  IsDireccion,
  IsEmailContacto,
  IsNit,
  IsNombreEntidad,
  IsTelefono,
} from '../../../common/validators/campos-contacto';

export class CrearClienteDto {
  @IsNit()
  nit!: string;

  @IsNombreEntidad()
  nombre!: string;

  @IsEmailContacto()
  email?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsDireccion()
  direccion?: string | null;
}
