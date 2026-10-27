import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import { PaginacionQueryDto } from '../../common/dto/paginacion.dto';
import type { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { Rol } from '../../generated/prisma/client';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { AjusteStockDto } from './dto/ajuste-stock.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ListarProductosQueryDto } from './dto/listar-productos.dto';
import {
  ProductoRespuestaDto,
  ProductosPaginadosDto,
} from './dto/producto-respuesta.dto';
import { ProductosService } from './productos.service';
import type { ProductoVista } from './productos.service';

// Lectura: todos los roles (VENDEDOR sin `costo`). Escritura: ADMIN, BODEGUERO.
@ApiTags('productos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso' })
@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listado paginado; ?buscar= por nombre o SKU, ?proveedorId=',
    description:
      'Solo activos. ?incluirInactivos=true: ADMIN y BODEGUERO (otros: 403). ' +
      'VENDEDOR recibe los productos sin `costo`.',
  })
  @ApiOkResponse({ type: ProductosPaginadosDto })
  listar(
    @Query() query: ListarProductosQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ProductoVista>> {
    return this.productos.listar(query, actor);
  }

  // DEBE ir antes de GET :id: si no, "stock-bajo" se tomaría como un :id
  // (y ParseIntPipe respondería 400)
  @Get('stock-bajo')
  @Roles(Rol.ADMIN, Rol.BODEGUERO, Rol.COMPRAS)
  @ApiOperation({
    summary: 'Productos activos con stock <= stockMinimo',
  })
  @ApiOkResponse({ type: ProductosPaginadosDto })
  stockBajo(
    @Query() query: PaginacionQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ProductoVista>> {
    return this.productos.stockBajo(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle (VENDEDOR: sin costo)' })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  @ApiNotFoundResponse()
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    return this.productos.obtener(id, actor);
  }

  @Post()
  @Roles(Rol.ADMIN, Rol.BODEGUERO)
  @ApiOperation({
    summary: 'Crear producto',
    description: 'El stock nace en 0; se carga con POST /:id/ajuste-stock.',
  })
  @ApiCreatedResponse({ type: ProductoRespuestaDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o proveedorId no es un proveedor activo',
  })
  @ApiConflictResponse({ description: 'SKU ya registrado' })
  crear(
    @Body() dto: CrearProductoDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    return this.productos.crear(dto, actor);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN, Rol.BODEGUERO)
  @ApiOperation({
    summary: 'Editar producto',
    description:
      'No admite `stock` (400): el stock solo cambia por ventas y ajuste-stock. ' +
      'activo: true reactiva el producto.',
  })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  @ApiBadRequestResponse({
    description:
      'Body vacío o inválido, `stock` en el body, proveedor inactivo',
  })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'SKU ya registrado' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProductoDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    return this.productos.actualizar(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN, Rol.BODEGUERO)
  @ApiOperation({ summary: 'Desactivar (borrado lógico)' })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  @ApiNotFoundResponse()
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    return this.productos.desactivar(id, actor);
  }

  @Post(':id/ajuste-stock')
  @Roles(Rol.ADMIN, Rol.BODEGUERO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ajustar stock (atómico). Positivo suma, negativo resta',
    description:
      'El motivo se escribe en el log de la aplicación con el usuario ' +
      '(no hay tabla de ajustes).',
  })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  @ApiBadRequestResponse({ description: 'cantidad 0 o motivo inválido' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Stock insuficiente' })
  ajustarStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjusteStockDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ProductoVista> {
    return this.productos.ajustarStock(id, dto, actor);
  }
}
