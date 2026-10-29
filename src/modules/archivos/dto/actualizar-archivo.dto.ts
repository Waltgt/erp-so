import { SiViene } from '../../../common/validators/si-viene';
import { IsCarpetaIdOpcional, IsNombreArchivo } from './campos-archivo';

// Renombrar, mover o ambas. Body vacío → 400 en el servicio. El objeto en el
// almacenamiento no cambia (sigue siendo el mismo UUID).
export class ActualizarArchivoDto {
  @SiViene()
  @IsNombreArchivo()
  nombreOriginal?: string;

  // undefined = no se mueve; null = mover a la raíz
  @IsCarpetaIdOpcional('Nueva carpeta (propia). null = mover a la raíz')
  carpetaId?: number | null;
}
