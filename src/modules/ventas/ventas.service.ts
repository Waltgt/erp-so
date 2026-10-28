import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginacionPrisma,
  RespuestaPaginada,
  respuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { EstadoVenta, Prisma, Rol } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { CrearVentaDto, ItemVentaDto } from './dto/crear-venta.dto';
import { ListarVentasQueryDto } from './dto/listar-ventas.dto';

// Mayor valor que cabe en Decimal(12,2)
export const TOTAL_MAXIMO = new Prisma.Decimal('9999999999.99');

// Listado: cliente y vendedor resumidos (del vendedor, nunca el hash)
const INCLUIR_RESUMEN = {
  cliente: { select: { id: true, nit: true, nombre: true } },
  usuario: { select: { id: true, nombre: true, email: true } },
} as const satisfies Prisma.VentaInclude;

// Detalle, crear y anular: además las líneas con nombre y SKU del producto
const INCLUIR_DETALLE = {
  ...INCLUIR_RESUMEN,
  detalles: {
    include: { producto: { select: { id: true, sku: true, nombre: true } } },
    orderBy: { productoId: 'asc' },
  },
} as const satisfies Prisma.VentaInclude;

export type VentaResumen = Prisma.VentaGetPayload<{
  include: typeof INCLUIR_RESUMEN;
}>;
export type VentaConDetalle = Prisma.VentaGetPayload<{
  include: typeof INCLUIR_DETALLE;
}>;

export interface LineaVenta {
  productoId: number;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
}

// Todo con Prisma.Decimal (nunca number): 3 × 19.99 = 59.97 exacto
export function calcularTotales(lineas: LineaVenta[]): {
  detalles: (LineaVenta & { subtotal: Prisma.Decimal })[];
  total: Prisma.Decimal;
} {
  const detalles = lineas.map((linea) => ({
    ...linea,
    subtotal: linea.precioUnitario.mul(linea.cantidad),
  }));
  const total = detalles.reduce(
    (suma, d) => suma.add(d.subtotal),
    new Prisma.Decimal(0),
  );
  // Si una línea excede el máximo, el total también
  if (total.gt(TOTAL_MAXIMO)) {
    throw new BadRequestException(
      `El total de la venta excede el máximo permitido (${TOTAL_MAXIMO.toFixed(2)})`,
    );
  }
  return { detalles, total };
}

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
  ) {}

  async listar(
    query: ListarVentasQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<VentaResumen>> {
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }

    const where: Prisma.VentaWhereInput = {
      ...filtroSegunRol(actor),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.desde || query.hasta
        ? { fecha: { gte: query.desde, lte: query.hasta } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.venta.findMany({
        where,
        include: INCLUIR_RESUMEN,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        ...paginacionPrisma(query),
      }),
      this.prisma.venta.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  // VENDEDOR pidiendo una venta ajena: 404, igual que si no existiera
  // (no revela que existe)
  async obtener(id: number, actor: UsuarioPublico): Promise<VentaConDetalle> {
    const venta = await this.prisma.venta.findFirst({
      where: { id, ...filtroSegunRol(actor) },
      include: INCLUIR_DETALLE,
    });
    if (!venta) {
      throw new NotFoundException('Venta no encontrada');
    }
    return venta;
  }

  // El vendedor sale del token (el DTO no tiene usuarioId) y el precio de la
  // base (el DTO no tiene precio).
  async crear(
    dto: CrearVentaDto,
    actor: UsuarioPublico,
  ): Promise<VentaConDetalle> {
    if (!(await this.clientes.estaActivo(dto.clienteId))) {
      throw new BadRequestException('clienteId debe ser un cliente activo');
    }

    // Mismo orden en todas las ventas: dos ventas simultáneas bloquean las
    // filas de productos en el mismo orden y no hay deadlock
    const items = [...dto.items].sort((a, b) => a.productoId - b.productoId);

    // Cualquier excepción dentro revierte TODO: ningún stock queda descontado
    return this.prisma.$transaction(async (tx) => {
      const lineas: LineaVenta[] = [];
      for (const item of items) {
        lineas.push(await descontarStock(tx, item));
      }

      const { detalles, total } = calcularTotales(lineas);
      return tx.venta.create({
        data: {
          clienteId: dto.clienteId,
          usuarioId: actor.id,
          total,
          detalles: {
            create: detalles.map((d) => ({
              productoId: d.productoId,
              cantidad: d.cantidad,
              precioUnitario: d.precioUnitario,
              subtotal: d.subtotal,
            })),
          },
        },
        include: INCLUIR_DETALLE,
      });
    });
  }

  async anular(id: number, dto: AnularVentaDto): Promise<VentaConDetalle> {
    return this.prisma.$transaction(async (tx) => {
      // Condicionado al estado: de dos anulaciones simultáneas solo una
      // cambia la fila (la otra espera el bloqueo y luego ve ANULADA), así
      // el stock se devuelve una sola vez
      const { count } = await tx.venta.updateMany({
        where: { id, estado: EstadoVenta.COMPLETADA },
        data: {
          estado: EstadoVenta.ANULADA,
          anuladaEn: new Date(),
          motivoAnulacion: dto.motivo,
        },
      });
      if (count === 0) {
        throw new ConflictException('La venta no existe o ya fue anulada');
      }

      // Mismo orden que al vender (por productoId)
      const detalles = await tx.detalleVenta.findMany({
        where: { ventaId: id },
        select: { productoId: true, cantidad: true },
        orderBy: { productoId: 'asc' },
      });
      // Se devuelve aunque el producto esté inactivo
      for (const detalle of detalles) {
        await tx.producto.update({
          where: { id: detalle.productoId },
          data: { stock: { increment: detalle.cantidad } },
        });
      }

      return tx.venta.findUniqueOrThrow({
        where: { id },
        include: INCLUIR_DETALLE,
      });
    });
  }
}

// ADMIN ve todas; los demás (VENDEDOR) solo las propias
function filtroSegunRol(actor: UsuarioPublico): Prisma.VentaWhereInput {
  return actor.rol === Rol.ADMIN ? {} : { usuarioId: actor.id };
}

// UPDATE ... WHERE activo AND stock >= n RETURNING: la condición, el
// descuento y la lectura del precio en UNA sentencia. La fila queda bloqueada
// hasta el fin de la transacción, así el precio no cambia entre medio.
async function descontarStock(
  tx: Prisma.TransactionClient,
  item: ItemVentaDto,
): Promise<LineaVenta> {
  const [producto] = await tx.producto.updateManyAndReturn({
    where: {
      id: item.productoId,
      activo: true,
      stock: { gte: item.cantidad },
    },
    data: { stock: { decrement: item.cantidad } },
    select: { precioVenta: true },
  });
  if (!producto) {
    throw new ConflictException(await motivoSinStock(tx, item));
  }
  return {
    productoId: item.productoId,
    cantidad: item.cantidad,
    precioUnitario: producto.precioVenta,
  };
}

// Solo en el camino de error: un mensaje que diga qué pasó con el producto
async function motivoSinStock(
  tx: Prisma.TransactionClient,
  item: ItemVentaDto,
): Promise<string> {
  const producto = await tx.producto.findUnique({
    where: { id: item.productoId },
    select: { sku: true, activo: true, stock: true },
  });
  if (!producto) {
    return `El producto ${item.productoId} no existe`;
  }
  if (!producto.activo) {
    return `El producto ${producto.sku} (id ${item.productoId}) está inactivo`;
  }
  return (
    `Stock insuficiente para ${producto.sku} (id ${item.productoId}): ` +
    `disponible ${producto.stock}, solicitado ${item.cantidad}`
  );
}
