import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginacionPrisma,
  RespuestaPaginada,
  respuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { busquedaNombreONit } from '../../common/utils/busqueda';
import { Cliente, Prisma, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarClientesQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<Cliente>> {
    if (query.incluirInactivos && actor.rol !== Rol.ADMIN) {
      throw new ForbiddenException('Solo ADMIN puede ver clientes inactivos');
    }

    const where: Prisma.ClienteWhereInput = {
      ...(query.incluirInactivos ? {} : { activo: true }),
      ...(query.buscar ? { OR: busquedaNombreONit(query.buscar) } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        ...paginacionPrisma(query),
      }),
      this.prisma.cliente.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  // Responde aunque el cliente esté inactivo: se usa para ver el historial
  async obtener(id: number): Promise<Cliente> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return cliente;
  }

  // NIT repetido (salvo CF): índice clientes_nit_unico → P2002 → 409
  // "NIT ya registrado" (filtro global)
  crear(dto: CrearClienteDto): Promise<Cliente> {
    return this.prisma.cliente.create({
      data: {
        nit: dto.nit,
        nombre: dto.nombre,
        email: dto.email ?? null,
        telefono: dto.telefono ?? null,
        direccion: dto.direccion ?? null,
      },
    });
  }

  // Cliente inexistente: P2025 → 404 (filtro global)
  async actualizar(
    id: number,
    dto: ActualizarClienteDto,
    actor: UsuarioPublico,
  ): Promise<Cliente> {
    if (Object.values(dto).every((valor) => valor === undefined)) {
      throw new BadRequestException(
        'Debe enviar al menos un campo a modificar',
      );
    }
    if (dto.activo !== undefined && actor.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo ADMIN puede activar o desactivar clientes',
      );
    }

    // undefined = no se toca; null = se borra (email, telefono, direccion)
    return this.prisma.cliente.update({
      where: { id },
      data: {
        nit: dto.nit,
        nombre: dto.nombre,
        email: dto.email,
        telefono: dto.telefono,
        direccion: dto.direccion,
        activo: dto.activo,
      },
    });
  }

  // DELETE: borrado lógico. Sus ventas siguen visibles.
  desactivar(id: number): Promise<Cliente> {
    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
  }
}
