import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Rol, Usuario } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { sinPassword } from '../usuarios/usuario.types';
import { AuthService, MENSAJE_CREDENCIALES } from './auth.service';

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 7,
    nombre: 'Ana',
    email: 'ana@empresa.com',
    passwordHash: 'hash-guardado',
    rol: Rol.VENDEDOR,
    activo: true,
    creadoEn: new Date('2026-10-01T00:00:00Z'),
    actualizadoEn: new Date('2026-10-01T00:00:00Z'),
    ...cambios,
  };
}

describe('AuthService', () => {
  let prisma: { usuario: { findUnique: jest.Mock; update: jest.Mock } };
  let passwords: { hashear: jest.Mock; verificar: jest.Mock };
  let jwt: { signAsync: jest.Mock };
  let servicio: AuthService;

  beforeEach(() => {
    prisma = { usuario: { findUnique: jest.fn(), update: jest.fn() } };
    passwords = {
      hashear: jest.fn().mockResolvedValue('hash-nuevo'),
      verificar: jest.fn(),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token.jwt') };
    servicio = new AuthService(
      prisma as unknown as PrismaService,
      passwords,
      jwt as unknown as JwtService,
    );
  });

  describe('login', () => {
    const dto = { email: 'ana@empresa.com', password: 'contraseña-larga' };

    it('devuelve token con { sub, rol } y el usuario sin passwordHash', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario());
      passwords.verificar.mockResolvedValue(true);

      const r = await servicio.login(dto);

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'ana@empresa.com' },
      });
      expect(passwords.verificar).toHaveBeenCalledWith(
        'hash-guardado',
        'contraseña-larga',
      );
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 7, rol: Rol.VENDEDOR });
      expect(r.accessToken).toBe('token.jwt');
      expect(r.usuario).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(r)).not.toContain('hash-guardado');
    });

    async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
      try {
        await promesa;
      } catch (e) {
        return e;
      }
      throw new Error('se esperaba un error');
    }

    it('email inexistente y contraseña incorrecta dan el MISMO 401', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce(null);
      passwords.verificar.mockResolvedValueOnce(false);
      const sinEmail = (await errorDe(
        servicio.login(dto),
      )) as UnauthorizedException;

      prisma.usuario.findUnique.mockResolvedValueOnce(usuario());
      passwords.verificar.mockResolvedValueOnce(false);
      const malaClave = (await errorDe(
        servicio.login(dto),
      )) as UnauthorizedException;

      expect(sinEmail).toBeInstanceOf(UnauthorizedException);
      expect(malaClave).toBeInstanceOf(UnauthorizedException);
      expect(sinEmail.getResponse()).toEqual(malaClave.getResponse());
      expect(sinEmail.message).toBe(MENSAJE_CREDENCIALES);
    });

    it('con email inexistente igual verifica contra un hash de relleno (mismo tiempo)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      passwords.hashear.mockResolvedValue('hash-relleno');
      passwords.verificar.mockResolvedValue(false);

      await expect(servicio.login(dto)).rejects.toThrow(MENSAJE_CREDENCIALES);
      await expect(servicio.login(dto)).rejects.toThrow(MENSAJE_CREDENCIALES);

      expect(passwords.verificar).toHaveBeenCalledWith(
        'hash-relleno',
        'contraseña-larga',
      );
      // El hash de relleno se calcula una sola vez
      expect(passwords.hashear).toHaveBeenCalledTimes(1);
    });

    it('usuario inactivo con contraseña correcta: el mismo 401', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario({ activo: false }));
      passwords.verificar.mockResolvedValue(true);
      await expect(servicio.login(dto)).rejects.toThrow(MENSAJE_CREDENCIALES);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('validarUsuarioDelToken', () => {
    it('devuelve el usuario actual de la base (sin passwordHash)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(
        sinPassword(usuario({ rol: Rol.ADMIN })),
      );

      const r = await servicio.validarUsuarioDelToken({
        sub: 7,
        rol: Rol.VENDEDOR,
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        omit: { passwordHash: true },
      });
      // El rol sale de la base, no del token
      expect(r.rol).toBe(Rol.ADMIN);
    });

    it('401 si el usuario ya no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(
        servicio.validarUsuarioDelToken({ sub: 7, rol: Rol.VENDEDOR }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('401 si el usuario fue desactivado (corta el acceso de inmediato)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 7, activo: false });
      await expect(
        servicio.validarUsuarioDelToken({ sub: 7, rol: Rol.VENDEDOR }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('cambiarPassword', () => {
    const dto = {
      passwordActual: 'actual-larga-1',
      passwordNueva: 'nueva-larga-2',
    };

    it('verifica la actual y guarda el hash de la nueva', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        passwordHash: 'hash-guardado',
      });
      passwords.verificar.mockResolvedValue(true);

      await servicio.cambiarPassword(7, dto);

      expect(passwords.verificar).toHaveBeenCalledWith(
        'hash-guardado',
        'actual-larga-1',
      );
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { passwordHash: 'hash-nuevo' },
        select: { id: true },
      });
    });

    it('400 si la contraseña actual es incorrecta', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ passwordHash: 'h' });
      passwords.verificar.mockResolvedValue(false);
      await expect(servicio.cambiarPassword(7, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('400 si la nueva es igual a la actual', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ passwordHash: 'h' });
      passwords.verificar.mockResolvedValue(true);
      await expect(
        servicio.cambiarPassword(7, {
          passwordActual: 'misma-larga-1',
          passwordNueva: 'misma-larga-1',
        }),
      ).rejects.toThrow('distinta');
    });
  });
});
