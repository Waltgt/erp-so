import { ListadoBusquedaQueryDto } from '../../../common/dto/paginacion.dto';
import { IsProveedorIdQuery } from './campos-producto';

// ?buscar= busca en nombre o SKU (ver ProductosService)
export class ListarProductosQueryDto extends ListadoBusquedaQueryDto {
  @IsProveedorIdQuery()
  proveedorId?: number;
}
