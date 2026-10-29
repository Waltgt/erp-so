// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Carpeta, ContenidoCarpeta } from '@/types/archivos'
import { useRutaCarpetas } from '../useRutaCarpetas'

function carpeta(id: number, parentId: number | null): Carpeta {
  return { id, nombre: `c${id}`, parentId, usuarioId: 1, creadoEn: '2026-10-01T00:00:00.000Z' }
}

// raíz → 1 → 2 → 3
const arbol: Record<number, Carpeta> = { 1: carpeta(1, null), 2: carpeta(2, 1), 3: carpeta(3, 2) }

function cargarFalso() {
  return vi.fn<(id: number) => Promise<ContenidoCarpeta>>((id: number) =>
    Promise.resolve<ContenidoCarpeta>({ carpeta: arbol[id]!, carpetas: [], archivos: [] }),
  )
}

describe('useRutaCarpetas', () => {
  it('en la raíz la ruta está vacía', async () => {
    const cargar = cargarFalso()
    expect(await useRutaCarpetas(cargar).rutaHasta(null)).toEqual([])
    expect(cargar).not.toHaveBeenCalled()
  })

  it('pide los padres que no conoce (ej. al recargar la página)', async () => {
    const cargar = cargarFalso()
    const ruta = useRutaCarpetas(cargar)
    expect((await ruta.rutaHasta(arbol[3]!)).map((c) => c.id)).toEqual([1, 2, 3])
    expect(cargar.mock.calls.map((c) => c[0])).toEqual([2, 1])

    // La segunda vez ya los conoce
    cargar.mockClear()
    expect((await ruta.rutaHasta(arbol[3]!)).map((c) => c.id)).toEqual([1, 2, 3])
    expect(cargar).not.toHaveBeenCalled()
  })

  it('usa lo que ya se listó al navegar', async () => {
    const cargar = cargarFalso()
    const ruta = useRutaCarpetas(cargar)
    ruta.recordar({ carpeta: null, carpetas: [arbol[1]!], archivos: [] })
    ruta.recordar({ carpeta: arbol[1]!, carpetas: [arbol[2]!], archivos: [] })
    expect((await ruta.rutaHasta(arbol[3]!)).map((c) => c.id)).toEqual([1, 2, 3])
    expect(cargar).not.toHaveBeenCalled()
  })

  it('olvidar hace que se vuelva a pedir (ej. tras renombrar)', async () => {
    const cargar = cargarFalso()
    const ruta = useRutaCarpetas(cargar)
    ruta.recordar({ carpeta: arbol[1]!, carpetas: [arbol[2]!], archivos: [] })
    ruta.olvidar(1)
    await ruta.rutaHasta(arbol[2]!)
    expect(cargar).toHaveBeenCalledWith(1)
  })
})
