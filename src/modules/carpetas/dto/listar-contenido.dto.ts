import { IsCarpetaIdOpcional } from '../../archivos/dto/campos-archivo';

// GET /carpetas?parentId=3 → contenido de la carpeta 3;
// sin parentId (o ?parentId=) → raíz del usuario
export class ListarContenidoQueryDto {
  @IsCarpetaIdOpcional('Carpeta a listar. Ausente o vacío = raíz')
  parentId?: number;
}
