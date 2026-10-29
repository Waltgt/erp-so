import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaginacionQueryDto,
  paginacionPrisma,
  RespuestaPaginada,
  respuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { escaparLike } from '../../common/utils/escapar-like';
import { Prisma, Producto, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { AjusteStockDto } from './dto/ajuste-stock.dto';
import { normalizarSku } from './dto/campos-producto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ListarProductosQueryDto } from './dto/listar-productos.dto';

// Proveedor resumido en cada producto (para la tabla y para el pedido desde
// stock bajo). En la misma consulta, sin N+1.
const INCLUIR_PROVEEDOR = {
  proveedor: { select: { id: true, nombre: true, telefono: true } },
} satisfies Prisma.ProductoInclude;

export type ProveedorResumen = {
  id: number;
  nombre: string;
  telefono: string | null;
};

// Lo que ve cada rol: VENDEDOR recibe el producto SIN `costo`
export type ProductoVista = Omit<Producto, 'costo'> & {
  costo?: Prisma.Decimal;
  proveedor: ProveedorResumen | null;
};

// Stock bajo: cuántas unidades faltan para llegar al mínimo
export type ProductoStockBajo = ProductoVista & { faltante: number };

// Los que pueden desactivar/reactivar también ven los inactivos
const ROLES_VEN_INACTIVOS: Rol[] = [Rol.ADMIN, Rol.BODEGUERO];

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly proveedores: ProveedoresService,
  ) {}

  async listar(
    query: ListarProductosQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ProductoVista>> {
    if (query.incluirInactivos && !ROLES_VEN_INACTIVOS.includes(actor.rol)) {
      throw new ForbiddenException(
        'Solo ADMIN y BODEGUERO pueden ver productos inactivos',
      );
    }

    const where: Prisma.ProductoWhereInput = {
      ...(query.incluirInactivos ? {} : { activo: true }),
      ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
      ...(query.buscar ? { OR: busquedaNombreOSku(query.buscar) } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.producto.findMany({
        where,
        omit: omitirSegunRol(actor),
        include: INCLUIR_PROVEEDOR,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        ...paginacionPrisma(query),
      }),
      this.prisma.producto.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  // Productos activos con stock <= stockMinimo, de mayor a menor urgencia
  // (stockMinimo - stock). Prisma no ordena por una expresión: la página de
  // ids sale de SQL crudo y los productos (con omit e include) de findMany.
  async stockBajo(
    query: PaginacionQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ProductoStockBajo>> {
    const where: Prisma.ProductoWhereInput = {
      activo: true,
      stock: { lte: this.prisma.producto.fields.stockMinimo },
    };
    const { skip, take } = paginacionPrisma(query);

    const [pagina, total] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "erp"."productos"
        WHERE activo = true AND stock <= stock_minimo
        ORDER BY (stock_minimo - stock) DESC, nombre ASC, id ASC
        LIMIT ${take} OFFSET ${skip}`,
      this.prisma.producto.count({ where }),
    ]);

    const ids = pagina.map((fila) => fila.id);
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: ids } },
      omit: omitirSegunRol(actor),
      include: INCLUIR_PROVEEDOR,
    });
    // findMany no respeta el orden de `in`: se reordena según la página
    const porId = new Map(productos.map((p) => [p.id, p]));
    const data = ids.flatMap((id) => {
      const p = porId.get(id);
      return p ? [{ ...p, faltante: p.stockMinimo - p.stock }] : [];
    });
    return respuestaPaginada(data, total, query);
  }

  async obtener(id: number, actor: UsuarioPublico): Promise<ProductoVista> {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      omit: omitirSegunRol(actor),
      include: INCLUIR_PROVEEDOR,
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    return producto;
  }

  // SKU repetido: productos_sku_key → P2002 → 409 "SKU ya registrado".
  // El stock nace en 0: el inventario inicial se carga con ajuste-stock.
  async crear(
    dto: CrearProductoDto,
    actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    await this.validarProveedor(dto.proveedorId);
    return this.prisma.producto.create({
      data: {
        sku: dto.sku,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        precioVenta: new Prisma.Decimal(dto.precioVenta),
        costo: new Prisma.Decimal(dto.costo),
        stockMinimo: dto.stockMinimo ?? 0,
        proveedorId: dto.proveedorId ?? null,
      },
      omit: omitirSegunRol(actor),
      include: INCLUIR_PROVEEDOR,
    });
  }

  // El DTO no tiene `stock`. Producto inexistente: P2025 → 404.
  async actualizar(
    id: number,
    dto: ActualizarProductoDto,
    actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    if (Object.values(dto).every((valor) => valor === undefined)) {
      throw new BadRequestException(
        'Debe enviar al menos un campo a modificar',
      );
    }
    await this.validarProveedor(dto.proveedorId);

    return this.prisma.producto.update({
      where: { id },
      data: {
        sku: dto.sku,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        precioVenta: decimalOpcional(dto.precioVenta),
        costo: decimalOpcional(dto.costo),
        stockMinimo: dto.stockMinimo,
        proveedorId: dto.proveedorId,
        activo: dto.activo,
      },
      omit: omitirSegunRol(actor),
      include: INCLUIR_PROVEEDOR,
    });
  }

  desactivar(id: number, actor: UsuarioPublico): Promise<ProductoVista> {
    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
      omit: omitirSegunRol(actor),
      include: INCLUIR_PROVEEDOR,
    });
  }

  // ATÓMICO, sin leer-y-luego-escribir: la condición de stock suficiente va
  // en el mismo UPDATE, así dos ajustes simultáneos no pueden dejarlo < 0.
  // Se permite también sobre productos inactivos.
  async ajustarStock(
    id: number,
    dto: AjusteStockDto,
    actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    let producto: ProductoVista;

    if (dto.cantidad > 0) {
      // Inexistente: P2025 → 404
      producto = await this.prisma.producto.update({
        where: { id },
        data: { stock: { increment: dto.cantidad } },
        omit: omitirSegunRol(actor),
        include: INCLUIR_PROVEEDOR,
      });
    } else {
      // UPDATE ... WHERE stock >= n RETURNING *: la condición y la fila
      // resultante salen de la MISMA sentencia. (Con updateMany + una lectura
      // aparte, con ajustes concurrentes la respuesta podía mostrar el stock
      // que dejó otro ajuste.)
      const [actualizado] = await this.prisma.producto.updateManyAndReturn({
        where: { id, stock: { gte: -dto.cantidad } },
        data: { stock: { decrement: -dto.cantidad } },
        omit: omitirSegunRol(actor),
        include: INCLUIR_PROVEEDOR,
      });
      if (!actualizado) {
        // Solo en el camino de error: distinguir inexistente de insuficiente
        await this.obtener(id, actor);
        throw new ConflictException('Stock insuficiente');
      }
      producto = actualizado;
    }

    // Limitación conocida: no hay tabla de ajustes; el motivo solo queda en
    // el log. JSON.stringify evita que un motivo con saltos de línea
    // falsifique líneas del log.
    this.logger.log(
      `Ajuste de stock: producto ${id} (${producto.sku}) ` +
        `${dto.cantidad > 0 ? '+' : ''}${dto.cantidad} → stock ${producto.stock}; ` +
        `usuario ${actor.id} <${actor.email}>; motivo: ${JSON.stringify(dto.motivo)}`,
    );
    return producto;
  }

  // undefined (no viene) o null (sin proveedor): no hay nada que validar
  private async validarProveedor(
    proveedorId: number | null | undefined,
  ): Promise<void> {
    if (proveedorId == null) {
      return;
    }
    if (!(await this.proveedores.estaActivo(proveedorId))) {
      throw new BadRequestException('proveedorId debe ser un proveedor activo');
    }
  }
}

// VENDEDOR no ve el costo: se omite en la propia consulta, así el dato
// nunca sale de la base para ese rol.
function omitirSegunRol(actor: UsuarioPublico): Prisma.ProductoOmit {
  return actor.rol === Rol.VENDEDOR ? { costo: true } : {};
}

function decimalOpcional(
  valor: string | undefined,
): Prisma.Decimal | undefined {
  return valor === undefined ? undefined : new Prisma.Decimal(valor);
}

// Nombre: contiene, sin distinguir mayúsculas. SKU: contiene el texto
// normalizado (mayúsculas). Comodines de LIKE escapados.
function busquedaNombreOSku(buscar: string): Prisma.ProductoWhereInput[] {
  return [
    { nombre: { contains: escaparLike(buscar), mode: 'insensitive' } },
    { sku: { contains: escaparLike(normalizarSku(buscar)) } },
  ];
}
