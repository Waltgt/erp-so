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
import { Prisma, Proveedor, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ListarProveedoresQueryDto } from './dto/listar-proveedores.dto';

export type ProveedorDetalle = Proveedor & { productosActivos: number };

// Quienes pueden desactivar/reactivar también pueden ver los inactivos
const ROLES_VEN_INACTIVOS: Rol[] = [Rol.ADMIN, Rol.COMPRAS];

// include para contar los productos ACTIVOS del proveedor
const CONTAR_PRODUCTOS_ACTIVOS = {
  _count: { select: { productos: { where: { activo: true } } } },
} satisfies Prisma.ProveedorInclude;

type ProveedorConConteo = Proveedor & { _count: { productos: number } };

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarProveedoresQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<Proveedor>> {
    if (query.incluirInactivos && !ROLES_VEN_INACTIVOS.includes(actor.rol)) {
      throw new ForbiddenException(
        'Solo ADMIN y COMPRAS pueden ver proveedores inactivos',
      );
    }

    const where: Prisma.ProveedorWhereInput = {
      ...(query.incluirInactivos ? {} : { activo: true }),
      ...(query.buscar ? { OR: busquedaNombreONit(query.buscar) } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.proveedor.findMany({
        where,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        ...paginacionPrisma(query),
      }),
      this.prisma.proveedor.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  // Incluye el conteo de productos activos. Responde aunque esté inactivo.
  async obtener(id: number): Promise<ProveedorDetalle> {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
      include: CONTAR_PRODUCTOS_ACTIVOS,
    });
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return conConteo(proveedor);
  }

  // NIT repetido: proveedores_nit_key → P2002 → 409 "NIT ya registrado"
  crear(dto: CrearProveedorDto): Promise<Proveedor> {
    return this.prisma.proveedor.create({
      data: {
        nit: dto.nit,
        nombre: dto.nombre,
        contacto: dto.contacto ?? null,
        telefono: dto.telefono ?? null,
        email: dto.email ?? null,
        direccion: dto.direccion ?? null,
      },
    });
  }

  // Proveedor inexistente: P2025 → 404 (filtro global)
  async actualizar(
    id: number,
    dto: ActualizarProveedorDto,
  ): Promise<Proveedor> {
    if (Object.values(dto).every((valor) => valor === undefined)) {
      throw new BadRequestException(
        'Debe enviar al menos un campo a modificar',
      );
    }

    // undefined = no se toca; null = se borra (campos opcionales)
    return this.prisma.proveedor.update({
      where: { id },
      data: {
        nit: dto.nit,
        nombre: dto.nombre,
        contacto: dto.contacto,
        telefono: dto.telefono,
        email: dto.email,
        direccion: dto.direccion,
        activo: dto.activo,
      },
    });
  }

  // DELETE: borrado lógico. Se permite aunque tenga productos activos; la
  // respuesta dice cuántos quedan asociados para que el front avise.
  async desactivar(id: number): Promise<ProveedorDetalle> {
    const proveedor = await this.prisma.proveedor.update({
      where: { id },
      data: { activo: false },
      include: CONTAR_PRODUCTOS_ACTIVOS,
    });
    return conConteo(proveedor);
  }
}

function conConteo({
  _count,
  ...proveedor
}: ProveedorConConteo): ProveedorDetalle {
  return { ...proveedor, productosActivos: _count.productos };
}
