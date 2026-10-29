import type { Paginado } from '@/types/api'
import type {
  ActualizarArchivoPeticion,
  ActualizarCarpetaPeticion,
  Archivo,
  ArchivoListado,
  Carpeta,
  ContenidoCarpeta,
  CrearCarpetaPeticion,
  ListarArchivosParametros,
  ModoUrl,
  UrlFirmada,
} from '@/types/archivos'
import { http } from './http'

// Todos los roles. Cada usuario ve lo suyo; ADMIN ve todos los archivos
// (pero sus carpetas son siempre las propias).

// ─── Carpetas ───────────────────────────────────────────────────────
// parentId null = raíz
export async function contenidoCarpeta(parentId: number | null): Promise<ContenidoCarpeta> {
  const { data } = await http.get<ContenidoCarpeta>('/carpetas', {
    params: parentId === null ? {} : { parentId },
  })
  return data
}

export async function crearCarpeta(datos: CrearCarpetaPeticion): Promise<Carpeta> {
  const { data } = await http.post<Carpeta>('/carpetas', datos)
  return data
}

export async function actualizarCarpeta(
  id: number,
  datos: ActualizarCarpetaPeticion,
): Promise<Carpeta> {
  const { data } = await http.patch<Carpeta>(`/carpetas/${id}`, datos)
  return data
}

// 409 si tiene subcarpetas o archivos
export async function borrarCarpeta(id: number): Promise<void> {
  await http.delete(`/carpetas/${id}`)
}

// ─── Archivos ───────────────────────────────────────────────────────
export async function listarArchivos(
  parametros: ListarArchivosParametros = {},
): Promise<Paginado<ArchivoListado>> {
  const { data } = await http.get<Paginado<ArchivoListado>>('/archivos', { params: parametros })
  return data
}

// Un archivo por petición. carpetaId va ANTES del archivo en el multipart:
// el backend lo manda al almacenamiento mientras llega. 413 si supera el
// límite, 415 si el tipo no está permitido.
export async function subirArchivo(
  archivo: File,
  carpetaId: number | null,
  alProgresar?: (fraccion: number) => void,
): Promise<Archivo> {
  const formulario = new FormData()
  if (carpetaId !== null) {
    formulario.append('carpetaId', String(carpetaId))
  }
  formulario.append('archivo', archivo, archivo.name)
  const { data } = await http.post<Archivo>('/archivos', formulario, {
    // Un archivo grande puede tardar más que el timeout normal
    timeout: 0,
    onUploadProgress: (evento) => {
      if (alProgresar && evento.total) {
        alProgresar(evento.loaded / evento.total)
      }
    },
  })
  return data
}

export async function actualizarArchivo(
  id: number,
  datos: ActualizarArchivoPeticion,
): Promise<Archivo> {
  const { data } = await http.patch<Archivo>(`/archivos/${id}`, datos)
  return data
}

export async function borrarArchivo(id: number): Promise<void> {
  await http.delete(`/archivos/${id}`)
}

// URL firmada para reproducir (ver) o descargar. Nunca se construyen URLs
// del almacenamiento en el front.
export async function urlArchivo(id: number, modo: ModoUrl): Promise<UrlFirmada> {
  const { data } = await http.get<UrlFirmada>(`/archivos/${id}/url`, { params: { modo } })
  return data
}
