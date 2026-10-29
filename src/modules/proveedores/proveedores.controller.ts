import {
  Body,
  Controller,
  Delete,
  Get,
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
import type { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { Rol } from '../../generated/prisma/client';
import type { Proveedor } from '../../generated/prisma/client';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ListarProveedoresQueryDto } from './dto/listar-proveedores.dto';
import {
  ProveedorDetalleDto,
  ProveedoresPaginadosDto,
  ProveedorRespuestaDto,
} from './dto/proveedor-respuesta.dto';
import { ProveedoresService } from './proveedores.service';
import type { ProveedorDetalle } from './proveedores.service';

// Lectura: ADMIN, COMPRAS, BODEGUERO. Escritura: ADMIN, COMPRAS.
@ApiTags('proveedores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso' })
@Roles(Rol.ADMIN, Rol.COMPRAS)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.COMPRAS, Rol.BODEGUERO)
  @ApiOperation({
    summary: 'Listado paginado; ?buscar= por nombre o NIT',
    description:
      'Solo activos. ?incluirInactivos=true: ADMIN y COMPRAS (BODEGUERO: 403). ' +
      'Cada fila incluye productosActivos. ' +
      'La búsqueda no distingue mayúsculas, pero NO ignora tildes.',
  })
  @ApiOkResponse({ type: ProveedoresPaginadosDto })
  listar(
    @Query() query: ListarProveedoresQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ProveedorDetalle>> {
    return this.proveedores.listar(query, actor);
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.COMPRAS, Rol.BODEGUERO)
  @ApiOperation({
    summary: 'Detalle con el conteo de productos activos',
  })
  @ApiOkResponse({ type: ProveedorDetalleDto })
  @ApiNotFoundResponse()
  obtener(@Param('id', ParseIntPipe) id: number): Promise<ProveedorDetalle> {
    return this.proveedores.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear proveedor' })
  @ApiCreatedResponse({ type: ProveedorRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o NIT "CF"' })
  @ApiConflictResponse({ description: 'NIT ya registrado' })
  crear(@Body() dto: CrearProveedorDto): Promise<Proveedor> {
    return this.proveedores.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar proveedor',
    description: 'activo: true reactiva el proveedor.',
  })
  @ApiOkResponse({ type: ProveedorRespuestaDto })
  @ApiBadRequestResponse({ description: 'Body vacío, inválido o NIT "CF"' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'NIT ya registrado' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProveedorDto,
  ): Promise<Proveedor> {
    return this.proveedores.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desactivar (borrado lógico)',
    description:
      'Se permite aunque tenga productos activos; productosActivos indica ' +
      'cuántos quedan asociados para que el front avise.',
  })
  @ApiOkResponse({ type: ProveedorDetalleDto })
  @ApiNotFoundResponse()
  desactivar(@Param('id', ParseIntPipe) id: number): Promise<ProveedorDetalle> {
    return this.proveedores.desactivar(id);
  }
}
