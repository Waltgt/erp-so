import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  paginacionPrisma,
  RespuestaPaginada,
  respuestaPaginada,
} from '../../common/dto/paginacion.dto';
import { escaparLike } from '../../common/utils/escapar-like';
import { VariablesEntorno } from '../../config/env.validation';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Almacenamiento,
  ObjetoNoEncontradoError,
} from '../almacenamiento/almacenamiento';
import { CarpetasService } from '../carpetas/carpetas.service';
import { UsuarioPublico } from '../usuarios/usuario.types';
import {
  ArchivoPublico,
  filtroArchivosSegunRol,
  OMITIR_OBJECT_KEY,
} from './archivo.types';
import { contentDisposition } from './content-disposition';
import { nombreArchivoSubido } from './dto/campos-archivo';
import { ActualizarArchivoDto } from './dto/actualizar-archivo.dto';
import { ListarArchivosQueryDto } from './dto/listar-archivos.dto';
import { ModoUrl } from './dto/url-archivo.dto';
import {
  ArchivoDemasiadoGrandeError,
  descartar,
  limitarTamano,
} from './limitar-tamano';
import { normalizarMime, tipoDesdeMime } from './tipos-permitidos';

// Lo que entrega el parser del multipart (controlador): el archivo en
// stream, sin leer, con los datos de su parte
export interface ArchivoEntrante {
  contenido: Readable;
  nombre?: string;
  // Content-Type de la parte del multipart (lo declara el cliente)
  mimeType: string;
}

export interface UrlFirmada {
  url: string;
  expiraEn: Date;
}

const MB = 1024 * 1024;

// Propiedad: ADMIN ve, renombra, mueve y borra cualquier archivo; los demás
// solo los propios (lo ajeno responde 404, igual que lo que no existe).
//
// S3 y la base no se modifican en una sola transacción:
// - Subir: primero S3, después la fila; si la fila falla, se borra el objeto.
// - Borrar: primero la fila, después S3; si S3 falla, el object_key queda
//   huérfano y se registra en el log (no se revierte la fila).
@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);
  private readonly maximoBytes: number;
  private readonly segundosUrl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: Almacenamiento,
    private readonly carpetas: CarpetasService,
    config: ConfigService<VariablesEntorno, true>,
  ) {
    this.maximoBytes =
      config.get('ARCHIVO_TAMANO_MAX_MB', { infer: true }) * MB;
    this.segundosUrl = config.get('URL_FIRMADA_SEGUNDOS', { infer: true });
  }

  // El archivo SIEMPRE es del usuario del token (también si es ADMIN), así
  // que la carpeta destino debe ser suya
  async subir(
    entrante: ArchivoEntrante,
    carpetaId: number | undefined,
    actor: UsuarioPublico,
  ): Promise<ArchivoPublico> {
    const mimeType = normalizarMime(entrante.mimeType);
    const tipo = tipoDesdeMime(mimeType);

    // Validaciones antes de tocar S3. Si fallan, el archivo no se sube: se
    // descarta lo que falte por llegar.
    try {
      if (!tipo) {
        throw new UnsupportedMediaTypeException(
          `Tipo de archivo no permitido: ${mimeType || '(sin Content-Type)'}`,
        );
      }
      if (carpetaId !== undefined) {
        await this.carpetas.verificarCarpetaDe(
          carpetaId,
          actor.id,
          'carpetaId',
        );
      }
    } catch (error) {
      descartar(entrante.contenido);
      throw error;
    }

    // Nombre en el almacenamiento: un UUID, nunca el nombre original
    const objectKey = randomUUID();
    const contador = limitarTamano(entrante.contenido, this.maximoBytes);
    try {
      await this.almacenamiento.subir(objectKey, contador, mimeType);
    } catch (error) {
      descartar(entrante.contenido);
      // Normalmente no queda nada (la subida se aborta), pero por si acaso
      await this.borrarObjeto(objectKey, 'subida fallida');
      if (
        error instanceof ArchivoDemasiadoGrandeError ||
        contador.bytes > this.maximoBytes
      ) {
        throw new PayloadTooLargeException(
          `El archivo supera el máximo de ${this.maximoBytes / MB} MB`,
        );
      }
      throw error;
    }

    // tamano_bytes tiene CHECK (> 0)
    if (contador.bytes === 0) {
      await this.borrarObjeto(objectKey, 'archivo vacío');
      throw new BadRequestException('El archivo está vacío');
    }

    try {
      return await this.prisma.archivoMultimedia.create({
        data: {
          objectKey,
          nombreOriginal: nombreArchivoSubido(entrante.nombre),
          mimeType,
          tamanoBytes: contador.bytes,
          tipo,
          carpetaId: carpetaId ?? null,
          usuarioId: actor.id,
        },
        omit: OMITIR_OBJECT_KEY,
      });
    } catch (error) {
      // Ej. la carpeta se borró entre la verificación y el insert (P2003)
      await this.borrarObjeto(objectKey, 'insert fallido');
      throw error;
    }
  }

  async listar(
    query: ListarArchivosQueryDto,
    actor: UsuarioPublico,
  ): Promise<RespuestaPaginada<ArchivoPublico>> {
    const where: Prisma.ArchivoMultimediaWhereInput = {
      ...filtroArchivosSegunRol(actor),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.carpetaId !== undefined ? { carpetaId: query.carpetaId } : {}),
      ...(query.buscar
        ? {
            nombreOriginal: {
              contains: escaparLike(query.buscar),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.archivoMultimedia.findMany({
        where,
        omit: OMITIR_OBJECT_KEY,
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        ...paginacionPrisma(query),
      }),
      this.prisma.archivoMultimedia.count({ where }),
    ]);
    return respuestaPaginada(data, total, query);
  }

  async obtener(id: number, actor: UsuarioPublico): Promise<ArchivoPublico> {
    const archivo = await this.prisma.archivoMultimedia.findFirst({
      where: { id, ...filtroArchivosSegunRol(actor) },
      omit: OMITIR_OBJECT_KEY,
    });
    if (!archivo) {
      throw new NotFoundException('Archivo no encontrado');
    }
    return archivo;
  }

  // El navegador lee el archivo directo de Garage (a través de Nginx) con
  // una URL firmada de corta duración. La API solo verifica el permiso y
  // firma: el contenido no pasa por server-app.
  async urlFirmada(
    id: number,
    modo: ModoUrl,
    actor: UsuarioPublico,
  ): Promise<UrlFirmada> {
    const { objectKey, nombreOriginal, mimeType } = await this.buscar(
      id,
      actor,
    );
    // Antes de firmar: la firma lleva la hora, así expiraEn nunca queda
    // después del vencimiento real
    const expiraEn = new Date(Date.now() + this.segundosUrl * 1000);
    try {
      const url = await this.almacenamiento.urlFirmada(objectKey, {
        segundos: this.segundosUrl,
        contentType: mimeType,
        contentDisposition: contentDisposition(
          modo === ModoUrl.Descargar ? 'attachment' : 'inline',
          nombreOriginal,
        ),
      });
      // Sin la URL: es una credencial mientras no venza
      this.logger.log(
        `URL firmada emitida: usuario ${actor.id}, archivo ${id}, modo ${modo}`,
      );
      return { url, expiraEn };
    } catch (error) {
      if (error instanceof ObjetoNoEncontradoError) {
        this.logger.error(
          `Archivo ${id}: la fila existe pero el objeto ${objectKey} no está en el almacenamiento`,
        );
        throw new NotFoundException(
          'El contenido del archivo no está disponible',
        );
      }
      throw error;
    }
  }

  // Renombrar, mover o ambas. Al mover, la carpeta destino debe ser del
  // DUEÑO del archivo (si ADMIN mueve un archivo ajeno, a una carpeta del
  // dueño, no a una suya).
  async actualizar(
    id: number,
    dto: ActualizarArchivoDto,
    actor: UsuarioPublico,
  ): Promise<ArchivoPublico> {
    if (dto.nombreOriginal === undefined && dto.carpetaId === undefined) {
      throw new BadRequestException('Envía nombreOriginal, carpetaId o ambos');
    }

    const archivo = await this.buscar(id, actor);
    if (dto.carpetaId !== undefined && dto.carpetaId !== null) {
      await this.carpetas.verificarCarpetaDe(
        dto.carpetaId,
        archivo.usuarioId,
        'carpetaId',
      );
    }

    // Solo metadatos: el objeto en S3 sigue siendo el mismo UUID
    return this.prisma.archivoMultimedia.update({
      where: { id },
      data: { nombreOriginal: dto.nombreOriginal, carpetaId: dto.carpetaId },
      omit: OMITIR_OBJECT_KEY,
    });
  }

  async eliminar(id: number, actor: UsuarioPublico): Promise<void> {
    const { objectKey } = await this.buscar(id, actor);
    // Si otra petición lo borró en medio: P2025 → 404 (filtro de Prisma)
    await this.prisma.archivoMultimedia.delete({ where: { id } });
    await this.borrarObjeto(objectKey, `archivo ${id} borrado`);
  }

  // Con objectKey: solo para uso interno del servicio
  private async buscar(id: number, actor: UsuarioPublico) {
    const archivo = await this.prisma.archivoMultimedia.findFirst({
      where: { id, ...filtroArchivosSegunRol(actor) },
    });
    if (!archivo) {
      throw new NotFoundException('Archivo no encontrado');
    }
    return archivo;
  }

  // Nunca lanza: si S3 falla, el objeto queda huérfano y se registra el
  // object_key en el log para borrarlo a mano
  private async borrarObjeto(objectKey: string, motivo: string): Promise<void> {
    try {
      await this.almacenamiento.borrar(objectKey);
    } catch (error) {
      this.logger.error(
        `Objeto huérfano en el almacenamiento: ${objectKey} (${motivo}): ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
