import { ref } from 'vue'

// Lo que se usa de un <audio>/<video> (así se puede probar sin navegador)
export interface ElementoMedia {
  currentTime: number
  paused: boolean
  play(): Promise<void>
  addEventListener(
    tipo: 'loadedmetadata' | 'loadeddata',
    fn: () => void,
    opciones?: { once: boolean },
  ): void
}

// `src` de un <audio>/<video> con URL firmada. La URL vence (por defecto a
// los 15 min): si el elemento dispara `error` (ej. al adelantar después de
// varios minutos), se pide una URL nueva y se sigue desde el mismo segundo.
// Un solo reintento por falla: si la URL nueva también falla, alError
// devuelve false y la pantalla muestra el error.
//
// La URL solo vive en memoria (en `src`): nunca en localStorage ni en la
// interfaz.
export function useFuenteFirmada(pedirUrl: (archivoId: number) => Promise<string>) {
  const src = ref<string | null>(null)
  const archivoId = ref<number | null>(null)
  // Se usó el reintento y la URL nueva todavía no cargó
  let reintentando = false

  async function abrir(id: number): Promise<void> {
    archivoId.value = id
    reintentando = false
    src.value = null
    src.value = await pedirUrl(id)
  }

  function cerrar(): void {
    archivoId.value = null
    src.value = null
    reintentando = false
  }

  // Para @error del elemento. true = se pidió una URL nueva y se retoma.
  async function alError(elemento: ElementoMedia): Promise<boolean> {
    const id = archivoId.value
    if (id === null || reintentando) {
      return false
    }
    reintentando = true
    const posicion = elemento.currentTime
    const seguir = !elemento.paused
    let url: string
    try {
      url = await pedirUrl(id)
    } catch {
      return false
    }
    if (archivoId.value !== id) {
      // Mientras tanto se abrió otro archivo
      return true
    }
    elemento.addEventListener(
      'loadedmetadata',
      () => {
        elemento.currentTime = posicion
        if (seguir) {
          elemento.play().catch(() => undefined)
        }
      },
      { once: true },
    )
    // Cargó bien: una próxima expiración vuelve a tener su reintento
    elemento.addEventListener(
      'loadeddata',
      () => {
        reintentando = false
      },
      { once: true },
    )
    src.value = url
    return true
  }

  return { src, archivoId, abrir, cerrar, alError }
}
