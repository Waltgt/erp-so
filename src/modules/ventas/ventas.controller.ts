import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import type { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { Rol } from '../../generated/prisma/client';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { ListarVentasQueryDto } from './dto/listar-ventas.dto';
import { VentaDetalleDto, VentasPaginadasDto } from './dto/venta-respuesta.dto';
import { VentasService } from './ventas.service';
import type { VentaConDetalle, VentaResumen } from './ventas.service';

// Vender y consultar: ADMIN, VENDEDOR (VENDEDOR solo las suyas). Anular: ADMIN.
@ApiTags('ventas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso' })
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({
    summary: 'Registrar venta (descuenta stock de forma atómica)',
    description:
      'El precio se lee de la base (un precio en el body da 400) y el ' +
      'vendedor es el usuario del token. Si un producto no alcanza, no se ' +
      'descuenta nada.',
  })
  @ApiCreatedResponse({ type: VentaDetalleDto })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, productoId repetido, campo no permitido o cliente inactivo',
  })
  @ApiConflictResponse({
    description: 'Un producto sin stock suficiente, inactivo o inexistente',
  })
  crear(
    @Body() dto: CrearVentaDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<VentaConDetalle> {
    return this.ventas.crear(dto, actor);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({
    summary: 'Listado paginado; ?desde=&hasta=, ?clienteId=, ?estado=',
    description: 'Más recientes primero. VENDEDOR solo ve sus ventas.',
  })
  @ApiOkResponse({ type: VentasPaginadasDto })
  @ApiBadRequestResponse({ description: 'Filtros inválidos o desde > hasta' })
  listar(
    @Query() query: ListarVentasQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<VentaResumen>> {
    return this.ventas.listar(query, actor);
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({
    summary: 'Detalle con productos, cliente y vendedor',
    description: 'VENDEDOR pidiendo una venta ajena: 404.',
  })
  @ApiOkResponse({ type: VentaDetalleDto })
  @ApiNotFoundResponse()
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<VentaConDetalle> {
    return this.ventas.obtener(id, actor);
  }

  @Post(':id/anular')
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular venta y devolver el stock',
    description: 'Las ventas no se borran. Solo se anula una vez.',
  })
  @ApiOkResponse({ type: VentaDetalleDto })
  @ApiBadRequestResponse({ description: 'motivo inválido (5 a 255)' })
  @ApiConflictResponse({ description: 'La venta no existe o ya fue anulada' })
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularVentaDto,
  ): Promise<VentaConDetalle> {
    return this.ventas.anular(id, dto);
  }
}
