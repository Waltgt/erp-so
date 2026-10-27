import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListadoQueryDto,
  paginacionPrisma,
  RespuestaPaginada,
  respuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { Prisma, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { PasswordService } from './password.service';
import { OMITIR_PASSWORD, UsuarioPublico } from './usuario.types';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async listar(
    query: ListadoQueryDto,
  ): Promise<RespuestaPaginada<UsuarioPublico>> {
    const where: Prisma.UsuarioWhereInput = query.incluirInactivos
      ? {}
      : { activo: true };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        omit: OMITIR_PASSWORD,
        orderBy: { id: 'asc' },
        ...paginacionPrisma(query),
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  async obtener(id: number): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      omit: OMITIR_PASSWORD,
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return usuario;
  }

  // Email duplicado: P2002 → 409 "Registro duplicado: email" (filtro global)
  async crear(dto: CrearUsuarioDto): Promise<UsuarioPublico> {
    return this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        rol: dto.rol,
        passwordHash: await this.passwords.hashear(dto.password),
      },
      omit: OMITIR_PASSWORD,
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarUsuarioDto,
    actor: UsuarioPublico,
  ): Promise<UsuarioPublico> {
    if (
      dto.nombre === undefined &&
      dto.rol === undefined &&
      dto.activo === undefined
    ) {
      throw new BadRequestException(
        'Debe enviar al menos un campo: nombre, rol o activo',
      );
    }

    const pierdeAdmin =
      dto.activo === false || (dto.rol !== undefined && dto.rol !== Rol.ADMIN);

    if (pierdeAdmin && id === actor.id) {
      throw new ConflictException(
        'No puede desactivarse ni quitarse el rol ADMIN a sí mismo',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (pierdeAdmin) {
        // Bloquea las filas de los admins activos hasta el fin de la
        // transacción: dos admins que se desactivan a la vez no pueden
        // dejar el sistema sin ninguno.
        const admins = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM "erp"."usuarios"
          WHERE rol = 'ADMIN' AND activo = true
          FOR UPDATE`;

        const esAdminActivo = admins.some((a) => a.id === id);
        if (esAdminActivo && admins.length <= 1) {
          throw new ConflictException(
            'No se puede desactivar ni degradar al último administrador activo',
          );
        }
      }

      // Usuario inexistente: P2025 → 404 (filtro global)
      return tx.usuario.update({
        where: { id },
        data: { nombre: dto.nombre, rol: dto.rol, activo: dto.activo },
        omit: OMITIR_PASSWORD,
      });
    });
  }

  // DELETE /usuarios/:id: borrado lógico, mismas reglas que PATCH activo=false
  desactivar(id: number, actor: UsuarioPublico): Promise<UsuarioPublico> {
    return this.actualizar(id, { activo: false }, actor);
  }

  async restablecerPassword(
    id: number,
    dto: RestablecerPasswordDto,
  ): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash: await this.passwords.hashear(dto.password) },
      select: { id: true },
    });
  }
}
