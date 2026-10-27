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
import type { Cliente } from '../../generated/prisma/client';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { ClientesService } from './clientes.service';
import {
  ClienteRespuestaDto,
  ClientesPaginadosDto,
} from './dto/cliente-respuesta.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso' })
@Roles(Rol.ADMIN, Rol.VENDEDOR)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listado paginado; ?buscar= por nombre o NIT',
    description:
      'Solo activos. ?incluirInactivos=true es solo para ADMIN (otro rol: 403). ' +
      'La búsqueda no distingue mayúsculas, pero NO ignora tildes.',
  })
  @ApiOkResponse({ type: ClientesPaginadosDto })
  listar(
    @Query() query: ListarClientesQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<Cliente>> {
    return this.clientes.listar(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle (también de clientes inactivos)' })
  @ApiOkResponse({ type: ClienteRespuestaDto })
  @ApiNotFoundResponse()
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Cliente> {
    return this.clientes.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear cliente' })
  @ApiCreatedResponse({ type: ClienteRespuestaDto })
  @ApiConflictResponse({ description: 'NIT ya registrado (CF sí se repite)' })
  crear(@Body() dto: CrearClienteDto): Promise<Cliente> {
    return this.clientes.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar cliente',
    description: 'El campo activo solo lo puede enviar ADMIN (reactivar).',
  })
  @ApiOkResponse({ type: ClienteRespuestaDto })
  @ApiBadRequestResponse({ description: 'Body vacío o inválido' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'NIT ya registrado' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarClienteDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<Cliente> {
    return this.clientes.actualizar(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Desactivar (borrado lógico). Solo ADMIN' })
  @ApiOkResponse({ type: ClienteRespuestaDto })
  @ApiNotFoundResponse()
  desactivar(@Param('id', ParseIntPipe) id: number): Promise<Cliente> {
    return this.clientes.desactivar(id);
  }
}
