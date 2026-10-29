import { ArchivoMultimedia, Prisma, Rol } from '../../generated/prisma/client';
import { UsuarioPublico } from '../usuarios/usuario.types';

// Se pasa como `omit` en toda consulta de archivos que llegue a una
// respuesta: el object_key es interno (se descarga por /archivos/:id/descarga)
export const OMITIR_OBJECT_KEY = {
  objectKey: true,
} as const satisfies Prisma.ArchivoMultimediaOmit;

export type ArchivoPublico = Omit<ArchivoMultimedia, 'objectKey'>;

// ADMIN ve (y modifica) todos; los demás solo los propios
export function filtroArchivosSegunRol(
  actor: UsuarioPublico,
): Prisma.ArchivoMultimediaWhereInput {
  return actor.rol === Rol.ADMIN ? {} : { usuarioId: actor.id };
}
