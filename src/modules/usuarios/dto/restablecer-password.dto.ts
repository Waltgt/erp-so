import { IsPasswordNueva } from './campos-usuario';

// ADMIN restablece la contraseña de otro usuario (no pide la actual)
export class RestablecerPasswordDto {
  @IsPasswordNueva()
  password!: string;
}
