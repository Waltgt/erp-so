import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { OPCIONES_VALIDACION } from '../../configurar-app';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import type { ArchivoListado, ArchivoPublico } from './archivo.types';
import { ArchivosService } from './archivos.service';
import type { UrlFirmada } from './archivos.service';
import { ActualizarArchivoDto } from './dto/actualizar-archivo.dto';
import {
  ArchivoRespuestaDto,
  ArchivosPaginadosDto,
} from './dto/archivo-respuesta.dto';
import { ListarArchivosQueryDto } from './dto/listar-archivos.dto';
import {
  SubirArchivoDto,
  SubirArchivoSwaggerDto,
} from './dto/subir-archivo.dto';
import { UrlArchivoQueryDto, UrlFirmadaDto } from './dto/url-archivo.dto';
import { descartar } from './limitar-tamano';
import { leerSubida } from './multipart';

// Los campos del multipart no pasan por el pipe global (el cuerpo lo lee
// leerSubida en stream): se validan con las mismas opciones
const validarCampos = new ValidationPipe(OPCIONES_VALIDACION);

// Todos los roles. Cada usuario ve y modifica solo sus archivos; ADMIN,
// todos. Un archivo ajeno responde 404, igual que uno que no existe.
@ApiTags('archivos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  @Post()
  @ApiOperation({
    summary: 'Subir un archivo (multipart/form-data, en stream)',
    description:
      'Campos: `carpetaId` (opcional) y `archivo`. **carpetaId debe ir ANTES ' +
      'del archivo**: el archivo se envía al almacenamiento mientras llega. ' +
      'El tipo se valida solo por el Content-Type de la parte. ' +
      'El archivo siempre es del usuario del token (también para ADMIN).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SubirArchivoSwaggerDto })
  @ApiCreatedResponse({ type: ArchivoRespuestaDto })
  @ApiBadRequestResponse({
    description:
      'Falta el archivo, archivo vacío, carpetaId inválido o de otro usuario, ' +
      'o algo después del archivo (otro archivo o un campo)',
  })
  @ApiPayloadTooLargeResponse({
    description: 'Supera ARCHIVO_TAMANO_MAX_MB (no queda nada guardado)',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Tipo no permitido, o el cuerpo no es multipart/form-data',
  })
  @ApiConflictResponse({
    description: 'La carpeta se borró mientras se subía el archivo',
  })
  async subir(
    @Req() req: Request,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ArchivoPublico> {
    const subida = await leerSubida(req);

    let dto: SubirArchivoDto;
    try {
      dto = (await validarCampos.transform(subida.campos, {
        type: 'body',
        metatype: SubirArchivoDto,
      })) as SubirArchivoDto;
    } catch (error) {
      descartar(subida.archivo.contenido);
      throw error;
    }

    const archivo = await this.archivos.subir(
      subida.archivo,
      dto.carpetaId,
      actor,
    );

    // Un campo después del archivo (ej. carpetaId) llegó tarde: el archivo
    // ya quedó en otra carpeta. Se deshace la subida en vez de ignorarlo.
    if (!(await subida.restoValido)) {
      await this.archivos.eliminar(archivo.id, actor);
      throw new BadRequestException(
        'Después del archivo no puede ir nada: envía carpetaId antes del ' +
          'archivo, y un solo archivo por petición',
      );
    }
    return archivo;
  }

  @Get()
  @ApiOperation({
    summary: 'Listado paginado; ?tipo=, ?carpetaId=, ?buscar=, ?usuarioId=',
    description:
      'ADMIN ve los archivos de todos los usuarios y puede filtrar por ' +
      '?usuarioId= (otro rol: 403). Cada archivo trae su dueño y su carpeta.',
  })
  @ApiOkResponse({ type: ArchivosPaginadosDto })
  listar(
    @Query() query: ListarArchivosQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ArchivoListado>> {
    return this.archivos.listar(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Metadatos' })
  @ApiOkResponse({ type: ArchivoRespuestaDto })
  @ApiNotFoundResponse()
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ArchivoPublico> {
    return this.archivos.obtener(id, actor);
  }

  @Get(':id/url')
  // La URL es una credencial mientras no venza: que nadie la guarde en caché
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'URL firmada para ver o descargar el archivo',
    description:
      'La API verifica el permiso y firma una URL de Garage (a través de ' +
      'Nginx en server-web, puerto 3900) válida por URL_FIRMADA_SEGUNDOS. ' +
      'modo=ver: inline, para <img>, <audio> o <video> (admite Range: se ' +
      'puede adelantar). modo=descargar: attachment con el nombre original.',
  })
  @ApiOkResponse({ type: UrlFirmadaDto })
  @ApiBadRequestResponse({ description: 'modo inválido' })
  @ApiNotFoundResponse({
    description: 'No existe, es ajeno, o falta el objeto en el almacenamiento',
  })
  url(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: UrlArchivoQueryDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<UrlFirmada> {
    return this.archivos.urlFirmada(id, query.modo, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Renombrar (nombreOriginal) o mover (carpetaId)',
    description:
      'Solo cambia metadatos. Si ADMIN mueve un archivo ajeno, la carpeta ' +
      'debe ser del dueño del archivo.',
  })
  @ApiOkResponse({ type: ArchivoRespuestaDto })
  @ApiBadRequestResponse({
    description: 'Body vacío o inválido, carpeta de otro usuario',
  })
  @ApiNotFoundResponse()
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarArchivoDto,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<ArchivoPublico> {
    return this.archivos.actualizar(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borrar (en la base y en el almacenamiento)',
    description:
      'Primero la fila, después el objeto. Si el almacenamiento falla, el ' +
      'object_key queda registrado en el log (la fila no se restaura).',
  })
  @ApiNoContentResponse({ description: 'Borrado' })
  @ApiNotFoundResponse()
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actor: UsuarioPublico,
  ): Promise<void> {
    return this.archivos.eliminar(id, actor);
  }
}
