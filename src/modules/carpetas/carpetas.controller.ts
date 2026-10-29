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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import { Carpeta } from '../../generated/prisma/client';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { CarpetasService } from './carpetas.service';
import type { ContenidoCarpeta } from './carpetas.service';
import { ActualizarCarpetaDto } from './dto/actualizar-carpeta.dto';
import {
  CarpetaRespuestaDto,
  ContenidoCarpetaDto,
} from './dto/carpeta-respuesta.dto';
import { CrearCarpetaDto } from './dto/crear-carpeta.dto';
import { ListarContenidoQueryDto } from './dto/listar-contenido.dto';

// Todos los roles, siempre sobre las carpetas propias (también ADMIN). Una
// carpeta ajena responde 404, igual que una que no existe.
@ApiTags('carpetas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@Controller('carpetas')
export class CarpetasController {
  constructor(private readonly carpetas: CarpetasService) {}

  @Get()
  @ApiOperation({
    summary: 'Contenido de un nivel: subcarpetas y archivos',
    description: 'Sin ?parentId= (o vacío): la raíz del usuario.',
  })
  @ApiOkResponse({ type: ContenidoCarpetaDto })
  @ApiNotFoundResponse({ description: 'parentId no existe o es ajena' })
  contenido(
    @Query() query: ListarContenidoQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ContenidoCarpeta> {
    return this.carpetas.contenido(query, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Crear carpeta (en la raíz o dentro de parentId)' })
  @ApiCreatedResponse({ type: CarpetaRespuestaDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o parentId no es una carpeta propia',
  })
  @ApiConflictResponse({ description: 'Ya hay una carpeta con ese nombre ahí' })
  crear(
    @Body() dto: CrearCarpetaDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<Carpeta> {
    return this.carpetas.crear(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Renombrar (nombre) o mover (parentId; null = raíz)',
  })
  @ApiOkResponse({ type: CarpetaRespuestaDto })
  @ApiBadRequestResponse({
    description:
      'Body vacío o inválido, parentId ajeno, o mover dentro de sí misma ' +
      'o de una subcarpeta (ciclo)',
  })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ya hay una carpeta con ese nombre ahí' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCarpetaDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<Carpeta> {
    return this.carpetas.actualizar(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar (solo si está vacía)' })
  @ApiNoContentResponse({ description: 'Borrada' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Tiene subcarpetas o archivos' })
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<void> {
    return this.carpetas.eliminar(id, actor);
  }
}
