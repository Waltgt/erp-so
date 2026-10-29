import { ArchivoMultimedia, Prisma, Rol } from '../../generated/prisma/client';
import { UsuarioPublico } from '../usuarios/usuario.types';

// Se pasa como `omit` en toda consulta de archivos que llegue a una
// respuesta: el object_key es interno (se descarga por /archivos/:id/descarga)
export const OMITIR_OBJECT_KEY = {
  objectKey: true,
} as const satisfies Prisma.ArchivoMultimediaOmit;

export type ArchivoPublico = Omit<ArchivoMultimedia, 'objectKey'>;

// El listado (GET /archivos) agrega el dueño y la carpeta resumidos, en la
// misma consulta: la vista "Todos los archivos" del ADMIN muestra de quién
// es cada uno y dónde está
export const INCLUIR_DUENO_Y_CARPETA = {
  usuario: { select: { id: true, nombre: true } },
  carpeta: { select: { id: true, nombre: true } },
} satisfies Prisma.ArchivoMultimediaInclude;

export type ArchivoListado = ArchivoPublico & {
  usuario: { id: number; nombre: string };
  carpeta: { id: number; nombre: string } | null;
};

// ADMIN ve (y modifica) todos; los demás solo los propios
export function filtroArchivosSegunRol(
  actor: UsuarioPublico,
): Prisma.ArchivoMultimediaWhereInput {
  return actor.rol === Rol.ADMIN ? {} : { usuarioId: actor.id };
}
