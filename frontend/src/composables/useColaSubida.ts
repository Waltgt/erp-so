import { computed, ref } from 'vue'
import type { Archivo } from '@/types/archivos'
import { ARCHIVO_TAMANO_MAX_BYTES, ARCHIVO_TAMANO_MAX_MB } from '@/types/archivos'

export type EstadoSubida = 'pendiente' | 'subiendo' | 'listo' | 'error'

export interface Subida {
  clave: number
  nombre: string
  tamano: number
  estado: EstadoSubida
  // 0 a 100
  progreso: number
  error: string | null
}

export interface OpcionesColaSubida {
  subir: (
    archivo: File,
    carpetaId: number | null,
    alProgresar: (f: number) => void,
  ) => Promise<Archivo>
  // Mensaje para mostrar junto al archivo (413, 415, sin conexión...)
  mensajeDeError: (error: unknown) => string
  alSubir: (archivo: Archivo, carpetaId: number | null) => void
}

// Sube los archivos de a uno (para no saturar la conexión), con el progreso
// de cada uno. Un error (413, 415) marca solo ese archivo: los demás siguen.
export function useColaSubida(opciones: OpcionesColaSubida) {
  const subidas = ref<Subida[]>([])
  const pendientes = new Map<number, { archivo: File; carpetaId: number | null }>()
  let siguienteClave = 1
  let procesando = false

  const activa = computed(() =>
    subidas.value.some((s) => s.estado === 'pendiente' || s.estado === 'subiendo'),
  )

  // El tamaño se revisa antes de enviar (el límite que manda es el del
  // servidor). El tipo lo valida el backend (415).
  function agregar(archivos: readonly File[], carpetaId: number | null): void {
    for (const archivo of archivos) {
      const subida: Subida = {
        clave: siguienteClave++,
        nombre: archivo.name,
        tamano: archivo.size,
        estado: 'pendiente',
        progreso: 0,
        error: null,
      }
      if (archivo.size > ARCHIVO_TAMANO_MAX_BYTES) {
        subida.estado = 'error'
        subida.error = `Supera el máximo de ${ARCHIVO_TAMANO_MAX_MB} MB`
      } else if (archivo.size === 0) {
        subida.estado = 'error'
        subida.error = 'El archivo está vacío'
      } else {
        pendientes.set(subida.clave, { archivo, carpetaId })
      }
      subidas.value.push(subida)
    }
    void procesar()
  }

  async function procesar(): Promise<void> {
    if (procesando) {
      return
    }
    procesando = true
    try {
      let subida: Subida | undefined
      while ((subida = subidas.value.find((s) => s.estado === 'pendiente'))) {
        const datos = pendientes.get(subida.clave)!
        pendientes.delete(subida.clave)
        subida.estado = 'subiendo'
        const actual = subida
        try {
          const archivo = await opciones.subir(datos.archivo, datos.carpetaId, (fraccion) => {
            actual.progreso = Math.min(99, Math.round(fraccion * 100))
          })
          actual.estado = 'listo'
          actual.progreso = 100
          opciones.alSubir(archivo, datos.carpetaId)
        } catch (error) {
          actual.estado = 'error'
          actual.error = opciones.mensajeDeError(error)
        }
      }
    } finally {
      procesando = false
    }
  }

  // Quita de la lista lo que ya terminó (bien o con error)
  function limpiar(): void {
    subidas.value = subidas.value.filter((s) => s.estado === 'pendiente' || s.estado === 'subiendo')
  }

  return { subidas, activa, agregar, limpiar }
}
