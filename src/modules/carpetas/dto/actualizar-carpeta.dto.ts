import { SiViene } from '../../../common/validators/si-viene';
import { IsCarpetaIdOpcional } from '../../archivos/dto/campos-archivo';
import { IsNombreCarpeta } from './campos-carpeta';

// Renombrar, mover o ambas. Body vacío → 400 en el servicio.
export class ActualizarCarpetaDto {
  @SiViene()
  @IsNombreCarpeta({ opcional: true })
  nombre?: string;

  // undefined = no se mueve; null = mover a la raíz. No puede ser ella
  // misma ni una descendiente (400, se valida en el servicio).
  @IsCarpetaIdOpcional('Nueva carpeta padre (propia). null = mover a la raíz')
  parentId?: number | null;
}
