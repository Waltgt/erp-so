import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function errorPrisma(
  code: string,
  cause?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('detalle interno', {
    code,
    clientVersion: 'test',
    meta: cause ? { driverAdapterError: { cause } } : undefined,
  });
}

describe('PrismaExceptionFilter', () => {
  let filtro: PrismaExceptionFilter;

  beforeEach(() => {
    filtro = new PrismaExceptionFilter();
  });

  describe('traducir', () => {
    it('P2002 con índice de Prisma → 409 indicando el campo', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'usuarios_email_key' },
          table: 'usuarios',
        }),
      );
      expect(r).toEqual({
        statusCode: HttpStatus.CONFLICT,
        message: 'Registro duplicado: email',
        error: 'Conflict',
      });
    });

    it('P2002 en clientes_nit_unico → 409 "NIT ya registrado"', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'clientes_nit_unico' },
        }),
      );
      expect(r.statusCode).toBe(HttpStatus.CONFLICT);
      expect(r.message).toBe('NIT ya registrado');
    });

    it('P2002 en productos_sku_key → 409 "SKU ya registrado"', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', { constraint: { index: 'productos_sku_key' } }),
      );
      expect(r.message).toBe('SKU ya registrado');
    });

    it('P2002 en proveedores_nit_key → 409 "NIT ya registrado"', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', { constraint: { index: 'proveedores_nit_key' } }),
      );
      expect(r.message).toBe('NIT ya registrado');
    });

    it('P2002 con índice manual sin mensaje propio → campo del mapa', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', {
          constraint: { index: 'carpetas_nombre_unico' },
        }),
      );
      expect(r.message).toBe('Registro duplicado: nombre');
    });

    it('P2002 con fields → 409 con los campos', () => {
      const r = filtro.traducir(
        errorPrisma('P2002', { constraint: { fields: ['codigo'] } }),
      );
      expect(r.message).toBe('Registro duplicado: codigo');
    });

    it('P2002 sin información de la restricción → 409 genérico', () => {
      const r = filtro.traducir(errorPrisma('P2002'));
      expect(r.statusCode).toBe(HttpStatus.CONFLICT);
      expect(r.message).toBe('Registro duplicado');
    });

    it('P2003 → 409 registros relacionados', () => {
      const r = filtro.traducir(errorPrisma('P2003'));
      expect(r.statusCode).toBe(HttpStatus.CONFLICT);
      expect(r.message).toBe('No se puede: hay registros relacionados');
    });

    it('P2025 → 404 no encontrado', () => {
      const r = filtro.traducir(errorPrisma('P2025'));
      expect(r.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(r.message).toBe('No encontrado');
    });

    it('CHECK de PostgreSQL (23514) → 409 regla de integridad', () => {
      const r = filtro.traducir(
        errorPrisma('P2039', { kind: 'postgres', originalCode: '23514' }),
      );
      expect(r.statusCode).toBe(HttpStatus.CONFLICT);
      expect(r.message).toBe('Regla de integridad violada');
    });

    it('otro código → 500 sin detalles', () => {
      const r = filtro.traducir(
        errorPrisma('P2039', { originalCode: '42P01' }),
      );
      expect(r).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno',
        error: 'Internal Server Error',
      });
    });
  });

  describe('catch', () => {
    function hostFalso() {
      const json = jest.fn<void, [unknown]>();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({ getResponse: () => ({ status }) }),
      } as unknown as ArgumentsHost;
      return { host, status, json };
    }

    it('responde con el status y el cuerpo traducidos', () => {
      const { host, status, json } = hostFalso();
      filtro.catch(errorPrisma('P2025'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No encontrado' }),
      );
    });

    it('en un 500 registra el detalle en el log pero no lo envía', () => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { host, json } = hostFalso();

      filtro.catch(errorPrisma('P2010'), host);

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('detalle interno'),
        expect.anything(),
      );
      expect(JSON.stringify(json.mock.calls[0][0])).not.toContain(
        'detalle interno',
      );
      log.mockRestore();
    });
  });
});
