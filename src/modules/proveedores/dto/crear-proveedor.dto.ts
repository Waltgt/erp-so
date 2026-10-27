import {
  IsDireccion,
  IsEmailContacto,
  IsNit,
  IsNombreEntidad,
  IsTelefono,
  IsTextoOpcional,
} from '../../../common/validators/campos-contacto';

export class CrearProveedorDto {
  // Único siempre; "CF" no aplica a proveedores → 400
  @IsNit({ permitirCF: false })
  nit!: string;

  @IsNombreEntidad({ ejemplo: 'Distribuidora El Sol, S.A.' })
  nombre!: string;

  // Persona de contacto (VarChar(100))
  @IsTextoOpcional(100, 'María Gómez')
  contacto?: string | null;

  @IsTelefono()
  telefono?: string | null;

  @IsEmailContacto()
  email?: string | null;

  @IsDireccion()
  direccion?: string | null;
}
