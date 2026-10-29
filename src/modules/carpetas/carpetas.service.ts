import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Carpeta, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ArchivoPublico, OMITIR_OBJECT_KEY } from '../archivos/archivo.types';
import { UsuarioPublico } from '../usuarios/usuario.types';
import { ActualizarCarpetaDto } from './dto/actualizar-carpeta.dto';
import { CrearCarpetaDto } from './dto/crear-carpeta.dto';
import { ListarContenidoQueryDto } from './dto/listar-contenido.dto';

// Tope al subir por el árbol buscando ciclos. Ningún árbol real llega a
// esta profundidad; si se alcanza, los datos ya tienen un ciclo.
export const PROFUNDIDAD_MAXIMA = 1000;

export interface ContenidoCarpeta {
  carpeta: Carpeta | null;
  carpetas: Carpeta[];
  archivos: ArchivoPublico[];
}

// Prisma o la transacción en curso
type Cliente = Prisma.TransactionClient;

// Las carpetas son SIEMPRE del usuario del token, también para ADMIN: una
// carpeta ajena responde 404, igual que una que no existe.
@Injectable()
export class CarpetasService {
  constructor(private readonly prisma: PrismaService) {}

  // Un nivel del árbol: sin parentId, la raíz del usuario
  async contenido(
    query: ListarContenidoQueryDto,
    actor: UsuarioPublico,
  ): Promise<ContenidoCarpeta> {
    const parentId = query.parentId ?? null;
    const carpeta =
      parentId === null ? null : await this.obtenerPropia(parentId, actor);

    const [carpetas, archivos] = await Promise.all([
      this.prisma.carpeta.findMany({
        where: { usuarioId: actor.id, parentId },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.archivoMultimedia.findMany({
        where: { usuarioId: actor.id, carpetaId: parentId },
        omit: OMITIR_OBJECT_KEY,
        orderBy: [{ nombreOriginal: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return { carpeta, carpetas, archivos };
  }

  // Nombre repetido en el mismo nivel: el índice carpetas_nombre_unico da
  // P2002 y el filtro de Prisma responde 409
  async crear(dto: CrearCarpetaDto, actor: UsuarioPublico): Promise<Carpeta> {
    const parentId = dto.parentId ?? null;
    if (parentId !== null) {
      await this.verificarCarpetaDe(parentId, actor.id, 'parentId');
    }
    return this.prisma.carpeta.create({
      data: { nombre: dto.nombre, parentId, usuarioId: actor.id },
    });
  }

  // Renombrar, mover o ambas
  async actualizar(
    id: number,
    dto: ActualizarCarpetaDto,
    actor: UsuarioPublico,
  ): Promise<Carpeta> {
    if (dto.nombre === undefined && dto.parentId === undefined) {
      throw new BadRequestException('Envía nombre, parentId o ambos');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.parentId !== undefined) {
        // Un movimiento a la vez por usuario. Sin esto, mover A dentro de B
        // y B dentro de A al mismo tiempo pasarían las dos la verificación
        // y quedaría un ciclo. El bloqueo se libera al terminar la
        // transacción.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('erp.carpetas'), ${actor.id}::int)`;
      }

      await this.obtenerPropia(id, actor, tx);

      if (dto.parentId !== undefined && dto.parentId !== null) {
        if (dto.parentId === id) {
          throw new BadRequestException(
            'Una carpeta no puede moverse dentro de sí misma',
          );
        }
        await this.verificarCarpetaDe(dto.parentId, actor.id, 'parentId', tx);
        if (await esDescendiente(tx, dto.parentId, id)) {
          throw new BadRequestException(
            'Una carpeta no puede moverse dentro de una de sus subcarpetas',
          );
        }
      }

      return tx.carpeta.update({
        where: { id },
        data: { nombre: dto.nombre, parentId: dto.parentId },
      });
    });
  }

  // Solo vacía. La FK (ON DELETE RESTRICT) es la red de seguridad si entre
  // la verificación y el DELETE alguien agrega algo (P2003 → 409).
  async eliminar(id: number, actor: UsuarioPublico): Promise<void> {
    await this.obtenerPropia(id, actor);

    const [subcarpetas, archivos] = await Promise.all([
      this.prisma.carpeta.count({ where: { parentId: id } }),
      this.prisma.archivoMultimedia.count({ where: { carpetaId: id } }),
    ]);
    if (subcarpetas > 0 || archivos > 0) {
      throw new ConflictException(
        `La carpeta no está vacía: tiene ${subcarpetas} subcarpeta(s) y ` +
          `${archivos} archivo(s)`,
      );
    }

    await this.prisma.carpeta.delete({ where: { id } });
  }

  // Destino de un crear o mover (carpetas y archivos): debe existir y ser
  // del mismo usuario. Si no, 400 (no 404: el recurso de la URL sí existe,
  // lo inválido es un dato del body).
  async verificarCarpetaDe(
    carpetaId: number,
    usuarioId: number,
    campo: string,
    cliente: Cliente = this.prisma,
  ): Promise<void> {
    const carpeta = await cliente.carpeta.findFirst({
      where: { id: carpetaId, usuarioId },
      select: { id: true },
    });
    if (!carpeta) {
      throw new BadRequestException(
        `${campo} debe ser una carpeta existente del mismo usuario`,
      );
    }
  }

  private async obtenerPropia(
    id: number,
    actor: UsuarioPublico,
    cliente: Cliente = this.prisma,
  ): Promise<Carpeta> {
    const carpeta = await cliente.carpeta.findFirst({
      where: { id, usuarioId: actor.id },
    });
    if (!carpeta) {
      throw new NotFoundException('Carpeta no encontrada');
    }
    return carpeta;
  }
}

// ¿`destinoId` está dentro de `carpetaId` (a cualquier profundidad)? Sube
// desde el destino hasta la raíz; si en el camino aparece la carpeta, mover
// la carpeta ahí crearía un ciclo.
export async function esDescendiente(
  cliente: Cliente,
  destinoId: number,
  carpetaId: number,
): Promise<boolean> {
  let actual: number | null = destinoId;
  for (let nivel = 0; actual !== null; nivel++) {
    if (actual === carpetaId) {
      return true;
    }
    if (nivel >= PROFUNDIDAD_MAXIMA) {
      throw new Error(
        `Árbol de carpetas con más de ${PROFUNDIDAD_MAXIMA} niveles ` +
          `(¿ciclo?) desde la carpeta ${destinoId}`,
      );
    }
    const padre: { parentId: number | null } | null =
      await cliente.carpeta.findUnique({
        where: { id: actual },
        select: { parentId: true },
      });
    actual = padre?.parentId ?? null;
  }
  return false;
}
