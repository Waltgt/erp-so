// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { Archivo } from '@/types/archivos'
import { ARCHIVO_TAMANO_MAX_BYTES } from '@/types/archivos'
import { type OpcionesColaSubida, useColaSubida } from '../useColaSubida'

type Subir = OpcionesColaSubida['subir']

// Lo único que la cola usa de un File
function archivoFalso(name: string, size: number): File {
  return { name, size } as File
}

function subido(id: number): Archivo {
  return {
    id,
    nombreOriginal: `a${id}`,
    mimeType: 'text/plain',
    tamanoBytes: 1,
    tipo: 'DOCUMENTO',
    duracionSeg: null,
    carpetaId: null,
    usuarioId: 1,
    creadoEn: '2026-10-01T00:00:00.000Z',
  }
}

describe('useColaSubida', () => {
  it('sube de a uno, en orden, y avisa cada archivo subido', async () => {
    const resolver: Array<(a: Archivo) => void> = []
    const subir = vi.fn<Subir>(
      (_archivo: File, _carpetaId: number | null, _alProgresar: (f: number) => void) =>
        new Promise<Archivo>((resolve) => resolver.push(resolve)),
    )
    const alSubir = vi.fn<OpcionesColaSubida['alSubir']>()
    const cola = useColaSubida({ subir, mensajeDeError: () => 'x', alSubir })

    cola.agregar([archivoFalso('a.txt', 5), archivoFalso('b.txt', 5)], 4)
    expect(subir).toHaveBeenCalledTimes(1)
    expect(cola.subidas.value.map((s) => s.estado)).toEqual(['subiendo', 'pendiente'])
    expect(cola.activa.value).toBe(true)

    resolver[0]!(subido(1))
    await flushPromises()
    expect(subir).toHaveBeenCalledTimes(2)
    expect(subir.mock.calls[1]![1]).toBe(4)
    expect(alSubir).toHaveBeenCalledWith(subido(1), 4)

    resolver[1]!(subido(2))
    await flushPromises()
    expect(cola.subidas.value.map((s) => [s.estado, s.progreso])).toEqual([
      ['listo', 100],
      ['listo', 100],
    ])
    expect(cola.activa.value).toBe(false)
  })

  it('muestra el progreso sin llegar a 100 antes de la respuesta', async () => {
    let progresar: (f: number) => void = () => undefined
    let terminar: (a: Archivo) => void = () => undefined
    const cola = useColaSubida({
      subir: (_a, _c, alProgresar) => {
        progresar = alProgresar
        return new Promise((resolve) => (terminar = resolve))
      },
      mensajeDeError: () => 'x',
      alSubir: () => undefined,
    })
    cola.agregar([archivoFalso('a.txt', 5)], null)
    progresar(0.5)
    expect(cola.subidas.value[0]!.progreso).toBe(50)
    progresar(1)
    expect(cola.subidas.value[0]!.progreso).toBe(99)
    terminar(subido(1))
    await flushPromises()
    expect(cola.subidas.value[0]!.progreso).toBe(100)
  })

  it('un error marca solo ese archivo y la cola sigue', async () => {
    const subir = vi
      .fn<Subir>()
      .mockRejectedValueOnce(new Error('415'))
      .mockResolvedValueOnce(subido(2))
    const cola = useColaSubida({
      subir,
      mensajeDeError: (e) => `Falló: ${(e as Error).message}`,
      alSubir: () => undefined,
    })
    cola.agregar([archivoFalso('a.exe', 5), archivoFalso('b.txt', 5)], null)
    await flushPromises()
    expect(cola.subidas.value.map((s) => [s.estado, s.error])).toEqual([
      ['error', 'Falló: 415'],
      ['listo', null],
    ])
  })

  it('no envía archivos vacíos ni demasiado grandes', async () => {
    const subir = vi.fn<Subir>().mockResolvedValue(subido(1))
    const cola = useColaSubida({ subir, mensajeDeError: () => 'x', alSubir: () => undefined })
    cola.agregar(
      [
        archivoFalso('grande.mp4', ARCHIVO_TAMANO_MAX_BYTES + 1),
        archivoFalso('vacio.txt', 0),
        archivoFalso('justo.mp4', ARCHIVO_TAMANO_MAX_BYTES),
      ],
      null,
    )
    await flushPromises()
    expect(subir).toHaveBeenCalledTimes(1)
    expect(cola.subidas.value.map((s) => s.error)).toEqual([
      'Supera el máximo de 100 MB',
      'El archivo está vacío',
      null,
    ])
  })

  it('agregar mientras sube no inicia una segunda subida en paralelo', async () => {
    let terminar: (a: Archivo) => void = () => undefined
    const subir = vi
      .fn<Subir>()
      .mockImplementationOnce(() => new Promise((resolve) => (terminar = resolve)))
      .mockResolvedValueOnce(subido(2))
    const cola = useColaSubida({ subir, mensajeDeError: () => 'x', alSubir: () => undefined })
    cola.agregar([archivoFalso('a.txt', 5)], null)
    cola.agregar([archivoFalso('b.txt', 5)], 9)
    expect(subir).toHaveBeenCalledTimes(1)
    terminar(subido(1))
    await flushPromises()
    expect(subir).toHaveBeenCalledTimes(2)
    expect(subir.mock.calls[1]![1]).toBe(9)
  })

  it('limpiar quita solo lo terminado', async () => {
    let terminar: (a: Archivo) => void = () => undefined
    const subir = vi
      .fn<Subir>()
      .mockResolvedValueOnce(subido(1))
      .mockImplementationOnce(() => new Promise((resolve) => (terminar = resolve)))
    const cola = useColaSubida({ subir, mensajeDeError: () => 'x', alSubir: () => undefined })
    cola.agregar([archivoFalso('a.txt', 5), archivoFalso('b.txt', 5)], null)
    await flushPromises()
    cola.limpiar()
    expect(cola.subidas.value.map((s) => s.nombre)).toEqual(['b.txt'])
    terminar(subido(2))
    await flushPromises()
  })
})
