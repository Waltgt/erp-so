import {
  IsDireccion,
  IsEmailCliente,
  IsNit,
  IsNombreCliente,
  IsTelefono,
} from './campos-cliente';

export class CrearClienteDto {
  @IsNit()
  nit!: string;

  @IsNombreCliente()
  nombre!: string;

  @IsEmailCliente()
  email?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsDireccion()
  direccion?: string | null;
}
