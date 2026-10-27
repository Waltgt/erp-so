import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

// Con @prisma/adapter-pg, el detalle del error de PostgreSQL viene en
// meta.driverAdapterError.cause (Prisma 7 ya no llena meta.target).
interface CausaAdaptador {
  kind?: string;
  originalCode?: string;
  constraint?: { fields?: string[]; index?: string };
  table?: string;
}

// Índices únicos creados con SQL manual (docs/db/migration-extra.sql):
// su nombre no sigue el patrón <tabla>_<campo>_key de Prisma.
const CAMPOS_INDICES_MANUALES: Record<string, string> = {
  clientes_nit_unico: 'nit',
  carpetas_nombre_unico: 'nombre',
};

// Mensaje específico para un índice único (si no está aquí, se usa
// "Registro duplicado: <campo>")
const MENSAJES_DUPLICADO: Record<string, string> = {
  clientes_nit_unico: 'NIT ya registrado',
};

const PG_CHECK_VIOLATION = '23514';

export interface RespuestaError {
  statusCode: HttpStatus;
  message: string;
  error: string;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const respuesta = this.traducir(exception);

    if (respuesta.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      // El detalle va solo al log, nunca al cliente
      this.logger.error(
        `Error de Prisma ${exception.code}: ${exception.message}`,
        exception.stack,
      );
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(respuesta.statusCode)
      .json(respuesta);
  }

  traducir(exception: Prisma.PrismaClientKnownRequestError): RespuestaError {
    const causa = this.causa(exception);

    if (causa?.originalCode === PG_CHECK_VIOLATION) {
      return conflicto('Regla de integridad violada');
    }

    switch (exception.code) {
      case 'P2002': {
        const mensaje = MENSAJES_DUPLICADO[causa?.constraint?.index ?? ''];
        if (mensaje) {
          return conflicto(mensaje);
        }
        const campo = this.campoDuplicado(causa);
        return conflicto(
          campo ? `Registro duplicado: ${campo}` : 'Registro duplicado',
        );
      }
      case 'P2003':
        return conflicto('No se puede: hay registros relacionados');
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No encontrado',
          error: 'Not Found',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error interno',
          error: 'Internal Server Error',
        };
    }
  }

  private causa(
    exception: Prisma.PrismaClientKnownRequestError,
  ): CausaAdaptador | undefined {
    const meta = exception.meta as
      { driverAdapterError?: { cause?: CausaAdaptador } } | undefined;
    return meta?.driverAdapterError?.cause;
  }

  private campoDuplicado(causa: CausaAdaptador | undefined): string | null {
    const restriccion = causa?.constraint;
    if (restriccion?.fields?.length) {
      return restriccion.fields.join(', ');
    }

    const indice = restriccion?.index;
    if (!indice) {
      return null;
    }
    if (CAMPOS_INDICES_MANUALES[indice]) {
      return CAMPOS_INDICES_MANUALES[indice];
    }
    // Patrón de Prisma: <tabla>_<campo(s)>_key, ej. productos_codigo_key
    if (causa?.table && indice.startsWith(`${causa.table}_`)) {
      return indice.slice(causa.table.length + 1).replace(/_key$/, '');
    }
    return indice;
  }
}

function conflicto(message: string): RespuestaError {
  return { statusCode: HttpStatus.CONFLICT, message, error: 'Conflict' };
}
