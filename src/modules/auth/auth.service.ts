import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../usuarios/password.service';
import {
  OMITIR_PASSWORD,
  sinPassword,
  UsuarioPublico,
} from '../usuarios/usuario.types';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';

export interface PayloadJwt {
  sub: number;
  rol: Rol;
}

// Mismo mensaje para email inexistente, contraseña incorrecta y usuario
// inactivo: no revela qué emails existen.
export const MENSAJE_CREDENCIALES = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  // Hash de relleno: si el email no existe se verifica contra este, para
  // que la respuesta tarde lo mismo que con una contraseña incorrecta.
  private hashRelleno?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; usuario: UsuarioPublico }> {
    // dto.email ya viene con trim + minúsculas (LoginDto)
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    const hash = usuario?.passwordHash ?? (await this.obtenerHashRelleno());
    const coincide = await this.passwords.verificar(hash, dto.password);

    if (!usuario || !coincide || !usuario.activo) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    const payload: PayloadJwt = { sub: usuario.id, rol: usuario.rol };
    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: sinPassword(usuario),
    };
  }

  // La usa la estrategia JWT en CADA request: si el usuario ya no existe o
  // fue desactivado, su token deja de servir de inmediato.
  async validarUsuarioDelToken(payload: PayloadJwt): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      omit: OMITIR_PASSWORD,
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException();
    }
    return usuario;
  }

  async cambiarPassword(
    usuarioId: number,
    dto: CambiarPasswordDto,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { passwordHash: true },
    });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    // 400 y no 401: el usuario SÍ está autenticado; un 401 haría que el
    // front cierre la sesión.
    const coincide = await this.passwords.verificar(
      usuario.passwordHash,
      dto.passwordActual,
    );
    if (!coincide) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    if (dto.passwordNueva === dto.passwordActual) {
      throw new BadRequestException(
        'La contraseña nueva debe ser distinta de la actual',
      );
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await this.passwords.hashear(dto.passwordNueva) },
      select: { id: true },
    });
  }

  private obtenerHashRelleno(): Promise<string> {
    this.hashRelleno ??= this.passwords.hashear('relleno-sin-usuario');
    return this.hashRelleno;
  }
}
