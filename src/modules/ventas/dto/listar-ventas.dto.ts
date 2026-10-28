import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/dto/paginacion.dto';
import { EstadoVenta } from '../../../generated/prisma/client';

// Zona horaria del negocio (Guatemala: UTC-6, sin horario de verano). Una
// fecha sin hora ("2026-10-26") se interpreta como ese día en Guatemala.
export const DESFASE_NEGOCIO = '-06:00';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Fecha y hora ISO 8601 CON zona (Z o ±hh:mm). Sin zona sería ambiguo:
// dependería de la zona del servidor.
const FECHA_HORA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

// desde: inicio del día; hasta: fin del día (inclusive)
function aFecha(extremo: 'inicio' | 'fin') {
  return ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    if (SOLO_FECHA.test(value)) {
      const hora = extremo === 'inicio' ? '00:00:00.000' : '23:59:59.999';
      return validaODescarta(
        new Date(`${value}T${hora}${DESFASE_NEGOCIO}`),
        value,
      );
    }
    if (FECHA_HORA.test(value)) {
      return validaODescarta(new Date(value), value);
    }
    return value; // → IsDate falla → 400
  };
}

// "2026-02-30" pasa la regex pero no es una fecha real: se rechaza
function validaODescarta(fecha: Date, original: string): Date | string {
  if (Number.isNaN(fecha.getTime())) {
    return original;
  }
  const soloFecha = original.slice(0, 10);
  const reconstruida = new Date(`${soloFecha}T12:00:00Z`)
    .toISOString()
    .slice(0, 10);
  return reconstruida === soloFecha ? fecha : original;
}

function IsFechaFiltro(extremo: 'inicio' | 'fin'): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      example: extremo === 'inicio' ? '2026-10-01' : '2026-10-31',
      description:
        `"AAAA-MM-DD" (día completo en Guatemala, UTC-6) o fecha y hora ISO 8601 ` +
        `con zona (ej. 2026-10-26T15:00:00-06:00). ${
          extremo === 'fin' ? 'Inclusive.' : ''
        }`,
    }),
    IsOptional(),
    Transform(aFecha(extremo)),
    IsDate({
      message: `${extremo === 'inicio' ? 'desde' : 'hasta'} debe ser una fecha válida`,
    }),
  );
}

export class ListarVentasQueryDto extends PaginacionQueryDto {
  @IsFechaFiltro('inicio')
  desde?: Date;

  @IsFechaFiltro('fin')
  hasta?: Date;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  @ApiPropertyOptional({ enum: EstadoVenta })
  @IsOptional()
  @IsEnum(EstadoVenta)
  estado?: EstadoVenta;
}
