import { IsOptional } from 'class-validator';
import { IsNombreEntidad } from '../../../common/validators/campos-contacto';
import { IsDinero } from '../../../common/validators/is-dinero.decorator';
import {
  IsCantidadNoNegativa,
  IsDescripcion,
  IsProveedorId,
  IsSku,
} from './campos-producto';

export class CrearProductoDto {
  @IsSku()
  sku!: string;

  @IsNombreEntidad({ ejemplo: 'Laptop 14"' })
  nombre!: string;

  @IsDescripcion()
  descripcion?: string | null;

  @IsDinero()
  precioVenta!: string;

  @IsDinero()
  costo!: string;

  @IsOptional()
  @IsCantidadNoNegativa({ opcional: true })
  stockMinimo?: number;

  @IsProveedorId()
  proveedorId?: number | null;
}
