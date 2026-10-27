import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { IsNombreEntidad } from '../../../common/validators/campos-contacto';
import { IsDinero } from '../../../common/validators/is-dinero.decorator';
import { SiViene } from '../../../common/validators/si-viene';
import {
  IsCantidadNoNegativa,
  IsDescripcion,
  IsProveedorId,
  IsSku,
} from './campos-producto';

// SIN `stock`: el stock solo cambia por ventas y por ajuste-stock. Con
// forbidNonWhitelisted, enviar `stock` responde 400 "property stock should
// not exist".
export class ActualizarProductoDto {
  @SiViene()
  @IsSku({ opcional: true })
  sku?: string;

  @SiViene()
  @IsNombreEntidad({ opcional: true, ejemplo: 'Laptop 14"' })
  nombre?: string;

  @IsDescripcion()
  descripcion?: string | null;

  // Cambiar el precio no afecta ventas anteriores (detalle_venta guarda
  // una copia del precio)
  @SiViene()
  @IsDinero({ opcional: true })
  precioVenta?: string;

  @SiViene()
  @IsDinero({ opcional: true })
  costo?: string;

  @SiViene()
  @IsCantidadNoNegativa({ opcional: true })
  stockMinimo?: number;

  @IsProveedorId()
  proveedorId?: number | null;

  @ApiPropertyOptional({
    description: 'true reactiva el producto, false lo desactiva',
  })
  @SiViene()
  @IsBoolean()
  activo?: boolean;
}
