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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import {
  ListadoQueryDto,
  RespuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { Rol } from '../../generated/prisma/client';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import {
  UsuarioRespuestaDto,
  UsuariosPaginadosDto,
} from './dto/usuario-respuesta.dto';
import type { UsuarioPublico } from './usuario.types';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@ApiForbiddenResponse({ description: 'Solo ADMIN' })
@Roles(Rol.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listado paginado (solo activos por defecto)' })
  @ApiOkResponse({ type: UsuariosPaginadosDto })
  listar(
    @Query() query: ListadoQueryDto,
  ): Promise<RespuestaPaginada<UsuarioPublico>> {
    // Todo el controlador es solo ADMIN: incluirInactivos no necesita
    // una verificación de rol extra.
    return this.usuarios.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioPublico> {
    return this.usuarios.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiCreatedResponse({ type: UsuarioRespuestaDto })
  @ApiConflictResponse({ description: 'Email duplicado' })
  crear(@Body() dto: CrearUsuarioDto): Promise<UsuarioPublico> {
    return this.usuarios.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre, rol y/o activo' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiBadRequestResponse({ description: 'Body vacío o inválido' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Desactivarse/degradarse a sí mismo o al último admin activo',
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<UsuarioPublico> {
    return this.usuarios.actualizar(id, dto, actor);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restablecer la contraseña de un usuario' })
  @ApiNoContentResponse({ description: 'Contraseña restablecida' })
  @ApiNotFoundResponse()
  restablecerPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestablecerPasswordDto,
  ): Promise<void> {
    return this.usuarios.restablecerPassword(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desactivar (borrado lógico, igual que PATCH { activo: false })',
  })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Desactivarse a sí mismo o al último admin activo',
  })
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<UsuarioPublico> {
    return this.usuarios.desactivar(id, actor);
  }
}
