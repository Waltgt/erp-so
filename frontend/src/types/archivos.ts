import type { FechaIso, ParametrosPaginacion } from './api'

// Enum TipoArchivo del backend. OTRO existe pero no se usa al subir: lo que
// no está en la lista blanca se rechaza con 415.
export const TIPOS_ARCHIVO = ['MUSICA', 'DOCUMENTO', 'IMAGEN', 'VIDEO', 'OTRO'] as const
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number]

// Igual a ARCHIVO_TAMANO_MAX_MB del backend (.env.example: 100). El backend
// no lo informa por la API: si se cambia allá, cambiarlo aquí. El límite que
// manda es el del servidor (413).
export const ARCHIVO_TAMANO_MAX_MB = 100
export const ARCHIVO_TAMANO_MAX_BYTES = ARCHIVO_TAMANO_MAX_MB * 1024 * 1024

// Lista blanca del backend (src/modules/archivos/tipos-permitidos.ts), para
// el `accept` del selector. El backend valida por el Content-Type.
export const MIME_PERMITIDOS: readonly string[] = [
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
]
// Con las extensiones, para los sistemas que no reconocen algún MIME
export const ACCEPT_ARCHIVOS = [
  ...MIME_PERMITIDOS,
  '.mp3',
  '.ogg',
  '.wav',
  '.flac',
  '.m4a',
  '.pdf',
  '.docx',
  '.xlsx',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.mp4',
  '.webm',
].join(',')

export const NOMBRE_CARPETA_MAX = 100
export const NOMBRE_ARCHIVO_MAX = 255

export interface Carpeta {
  id: number
  nombre: string
  // null = raíz
  parentId: number | null
  usuarioId: number
  creadoEn: FechaIso
}

export interface Archivo {
  id: number
  // Solo para mostrar (en el almacenamiento se guarda con un UUID)
  nombreOriginal: string
  mimeType: string
  tamanoBytes: number
  tipo: TipoArchivo
  // El backend no la calcula por ahora (siempre null)
  duracionSeg: number | null
  // null = raíz
  carpetaId: number | null
  // Dueño
  usuarioId: number
  creadoEn: FechaIso
}

// GET /api/archivos: con el dueño y la carpeta resumidos
export interface ArchivoListado extends Archivo {
  usuario: { id: number; nombre: string }
  carpeta: { id: number; nombre: string } | null
}

// GET /api/carpetas?parentId=: un nivel (siempre de las carpetas propias,
// también para ADMIN). carpeta = null en la raíz.
export interface ContenidoCarpeta {
  carpeta: Carpeta | null
  carpetas: Carpeta[]
  archivos: Archivo[]
}

// GET /api/archivos (paginado). ADMIN ve todos; los demás, solo los suyos.
export interface ListarArchivosParametros extends ParametrosPaginacion {
  tipo?: TipoArchivo
  // Ausente = todas las carpetas
  carpetaId?: number
  buscar?: string
  // Solo ADMIN (otro rol: 403)
  usuarioId?: number
}

// POST /api/carpetas. 409 si ya hay una con ese nombre en el mismo nivel.
export interface CrearCarpetaPeticion {
  nombre: string
  // null = raíz
  parentId: number | null
}

// PATCH /api/carpetas/:id: renombrar o mover (null = raíz). No puede ir
// dentro de sí misma ni de una descendiente (400).
export interface ActualizarCarpetaPeticion {
  nombre?: string
  parentId?: number | null
}

// PATCH /api/archivos/:id: renombrar o mover (null = raíz, carpeta propia)
export interface ActualizarArchivoPeticion {
  nombreOriginal?: string
  carpetaId?: number | null
}

export type ModoUrl = 'ver' | 'descargar'

// GET /api/archivos/:id/url. NUNCA guardarla ni mostrarla en la interfaz.
export interface UrlFirmada {
  url: string
  expiraEn: FechaIso
}
