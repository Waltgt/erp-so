import {
  NOMBRE_ARCHIVO_MAX,
  NOMBRE_CARPETA_MAX,
  type Archivo,
  type ContenidoCarpeta,
  type TipoArchivo,
} from '@/types/archivos'

// Mismas reglas que el backend (IsNombreCarpeta / IsNombreArchivo). El
// backend es el que decide; esto solo evita el viaje en los casos obvios.
export function validarNombreCarpeta(nombre: string): string | null {
  const limpio = nombre.normalize('NFC').trim()
  if (limpio === '') {
    return 'Escribe un nombre'
  }
  if (Array.from(limpio).length > NOMBRE_CARPETA_MAX) {
    return `Máximo ${NOMBRE_CARPETA_MAX} caracteres`
  }
  if (/[/\\]/.test(limpio)) {
    return 'No puede contener / ni \\'
  }
  if (/[\p{Cc}\p{Cf}]/u.test(limpio)) {
    return 'Tiene caracteres no permitidos'
  }
  if (limpio === '.' || limpio === '..') {
    return 'No puede ser "." ni ".."'
  }
  return null
}

export function validarNombreArchivo(nombre: string): string | null {
  const limpio = nombre.trim()
  if (limpio === '') {
    return 'Escribe un nombre'
  }
  if (Array.from(limpio).length > NOMBRE_ARCHIVO_MAX) {
    return `Máximo ${NOMBRE_ARCHIVO_MAX} caracteres`
  }
  return null
}

// Filtros del nivel actual (el contenido de una carpeta llega completo).
// Con un tipo elegido, las carpetas no aplican y se ocultan.
export function filtrarNivel(
  contenido: Pick<ContenidoCarpeta, 'carpetas' | 'archivos'>,
  buscar: string,
  tipo: TipoArchivo | null,
): Pick<ContenidoCarpeta, 'carpetas' | 'archivos'> {
  const texto = buscar.trim().toLocaleLowerCase('es')
  const coincide = (nombre: string) =>
    texto === '' || nombre.toLocaleLowerCase('es').includes(texto)
  return {
    carpetas: tipo ? [] : contenido.carpetas.filter((c) => coincide(c.nombre)),
    archivos: contenido.archivos.filter(
      (a) => coincide(a.nombreOriginal) && (tipo === null || a.tipo === tipo),
    ),
  }
}

// Qué hacer al abrir un archivo
export type Visor = 'audio' | 'video' | 'imagen' | 'pdf' | 'descargar'

export function visorDe(archivo: Pick<Archivo, 'tipo' | 'mimeType'>): Visor {
  switch (archivo.tipo) {
    case 'MUSICA':
      return 'audio'
    case 'VIDEO':
      return 'video'
    case 'IMAGEN':
      return 'imagen'
    default:
      return archivo.mimeType === 'application/pdf' ? 'pdf' : 'descargar'
  }
}
