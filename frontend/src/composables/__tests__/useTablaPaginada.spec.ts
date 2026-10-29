// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import type { Paginado } from '@/types/api'
import { ESPERA_BUSQUEDA_MS, useTablaPaginada, type ParametrosListado } from '../useTablaPaginada'

type Filtros = { tipo?: string }
type Llamada = ParametrosListado & Filtros
type Cargar = (p: Llamada) => Promise<Paginado<number>>

function pagina(data: number[], total: number, p = 1): Paginado<number> {
  return { data, total, page: p, limit: 20 }
}

describe('useTablaPaginada', () => {
  const alError = vi.fn<(error: unknown) => void>()
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    vi.useFakeTimers()
    alError.mockReset()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  function crear(cargar: (p: Llamada) => Promise<Paginado<number>>) {
    return scope.run(() =>
      useTablaPaginada<number, Filtros>(cargar, { filtros: { tipo: undefined }, alError }),
    )!
  }

  it('carga la página 1 al crearse', async () => {
    const cargar = vi.fn<Cargar>((_p: Llamada) => Promise.resolve(pagina([1, 2], 2)))
    const t = crear(cargar)
    await vi.runAllTimersAsync()
    expect(cargar).toHaveBeenCalledWith({ tipo: undefined, page: 1, limit: 20 })
    expect(t.filas.value).toEqual([1, 2])
    expect(t.total.value).toBe(2)
    expect(t.cargando.value).toBe(false)
  })

  it('evento de página del DataTable (0-based) → page 1-based', async () => {
    const cargar = vi.fn<Cargar>((_p: Llamada) => Promise.resolve(pagina([3], 41, 3)))
    const t = crear(cargar)
    await t.alCambiarPagina({ page: 2, rows: 20 })
    expect(cargar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, limit: 20 }))
    expect(t.primera.value).toBe(40)
  })

  it('búsqueda: espera 300 ms tras la última tecla, vuelve a la página 1 y recorta', async () => {
    const cargar = vi.fn<Cargar>((_p: Llamada) => Promise.resolve(pagina([], 0)))
    const t = crear(cargar)
    await vi.runAllTimersAsync()
    cargar.mockClear()
    t.pagina.value = 4

    t.buscar.value = 'p'
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    t.buscar.value = ' pérez '
    await nextTick()
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS - 1)
    expect(cargar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(cargar).toHaveBeenCalledExactlyOnceWith({
      tipo: undefined,
      page: 1,
      limit: 20,
      buscar: 'pérez',
    })
  })

  it('cambiar un filtro recarga al instante desde la página 1', async () => {
    const cargar = vi.fn<Cargar>((_p: Llamada) => Promise.resolve(pagina([], 0)))
    const t = crear(cargar)
    await vi.runAllTimersAsync()
    cargar.mockClear()

    t.filtros.tipo = 'MUSICA'
    await nextTick()
    await Promise.resolve()
    expect(cargar).toHaveBeenCalledWith({ tipo: 'MUSICA', page: 1, limit: 20 })
  })

  it('una respuesta vieja que llega tarde se ignora', async () => {
    let resolverVieja: (v: Paginado<number>) => void = () => undefined
    const cargar = vi
      .fn<Cargar>((_p: Llamada) => Promise.resolve(pagina([], 0)))
      .mockImplementationOnce(() => new Promise((r) => (resolverVieja = r)))
      .mockImplementationOnce(() => Promise.resolve(pagina([2], 1)))
    const t = crear(cargar)
    await t.recargar() // la nueva
    resolverVieja(pagina([1], 1)) // la vieja llega después
    await vi.runAllTimersAsync()
    expect(t.filas.value).toEqual([2])
  })

  it('se borró lo último de la página: va a la última que queda', async () => {
    const cargar = vi.fn<Cargar>((p: Llamada) =>
      Promise.resolve(p.page === 3 ? pagina([], 40, 3) : pagina([21, 22], 40, 2)),
    )
    const t = crear(cargar)
    await t.irAPagina(3)
    expect(t.pagina.value).toBe(2)
    expect(t.primera.value).toBe(20)
    expect(t.filas.value).toEqual([21, 22])
  })

  it('error: lo entrega a alError y deja de cargar', async () => {
    const cargar = vi.fn<Cargar>((_p: Llamada) => Promise.reject(new Error('red')))
    const t = crear(cargar)
    await vi.runAllTimersAsync()
    expect(alError).toHaveBeenCalledOnce()
    expect(t.cargando.value).toBe(false)
  })
})
