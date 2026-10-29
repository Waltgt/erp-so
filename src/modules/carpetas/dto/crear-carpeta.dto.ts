import { IsCarpetaIdOpcional } from '../../archivos/dto/campos-archivo';
import { IsNombreCarpeta } from './campos-carpeta';

// La carpeta siempre es del usuario del token (no hay usuarioId en el body)
export class CrearCarpetaDto {
  @IsNombreCarpeta()
  nombre!: string;

  @IsCarpetaIdOpcional('Carpeta padre (propia). Ausente o null = raíz')
  parentId?: number | null;
}
