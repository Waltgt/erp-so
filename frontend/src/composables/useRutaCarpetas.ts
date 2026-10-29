import type { Carpeta, ContenidoCarpeta } from '@/types/archivos'

// Ruta de la raíz hasta una carpeta (para el Breadcrumb). El backend solo
// lista un nivel, y cada carpeta trae su parentId: los padres conocidos se
// recuerdan, y los que faltan (ej. al recargar en /archivos?carpeta=12) se
// piden subiendo de a un nivel.
export function useRutaCarpetas(cargar: (id: number) => Promise<ContenidoCarpeta>) {
  const conocidas = new Map<number, Carpeta>()

  function recordar(contenido: ContenidoCarpeta): void {
    if (contenido.carpeta) {
      conocidas.set(contenido.carpeta.id, contenido.carpeta)
    }
    for (const carpeta of contenido.carpetas) {
      conocidas.set(carpeta.id, carpeta)
    }
  }

  function olvidar(id: number): void {
    conocidas.delete(id)
  }

  async function rutaHasta(carpeta: Carpeta | null): Promise<Carpeta[]> {
    const ruta: Carpeta[] = []
    let actual = carpeta
    // Tope por si los datos tuvieran un ciclo (el backend no lo permite)
    for (let nivel = 0; actual && nivel < 100; nivel++) {
      ruta.unshift(actual)
      if (actual.parentId === null) {
        break
      }
      let padre = conocidas.get(actual.parentId)
      if (!padre) {
        const contenido = await cargar(actual.parentId)
        recordar(contenido)
        padre = contenido.carpeta ?? undefined
      }
      actual = padre ?? null
    }
    return ruta
  }

  return { recordar, olvidar, rutaHasta }
}
