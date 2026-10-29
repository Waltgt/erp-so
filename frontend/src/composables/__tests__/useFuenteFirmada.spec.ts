// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { type ElementoMedia, useFuenteFirmada } from '../useFuenteFirmada'

type PedirUrl = (archivoId: number) => Promise<string>

function elementoFalso(currentTime: number, paused: boolean) {
  const oyentes = new Map<string, () => void>()
  const elemento = {
    currentTime,
    paused,
    play: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    addEventListener: (tipo: string, fn: () => void) => oyentes.set(tipo, fn),
  } satisfies ElementoMedia
  const disparar = (tipo: string) => {
    const fn = oyentes.get(tipo)
    oyentes.delete(tipo)
    fn?.()
  }
  return { elemento, disparar }
}

describe('useFuenteFirmada', () => {
  it('abrir pide la URL del archivo', async () => {
    const pedirUrl = vi.fn<PedirUrl>().mockResolvedValue('u1')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    expect(pedirUrl).toHaveBeenCalledWith(5)
    expect(fuente.src.value).toBe('u1')
    fuente.cerrar()
    expect(fuente.src.value).toBeNull()
  })

  it('al vencer pide otra URL y sigue desde el mismo segundo', async () => {
    const pedirUrl = vi.fn<PedirUrl>().mockResolvedValueOnce('u1').mockResolvedValueOnce('u2')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    const { elemento, disparar } = elementoFalso(312, false)

    expect(await fuente.alError(elemento)).toBe(true)
    expect(fuente.src.value).toBe('u2')
    elemento.currentTime = 0
    disparar('loadedmetadata')
    expect(elemento.currentTime).toBe(312)
    expect(elemento.play).toHaveBeenCalled()
  })

  it('no reproduce si estaba en pausa', async () => {
    const pedirUrl = vi.fn<PedirUrl>().mockResolvedValue('u')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    const { elemento, disparar } = elementoFalso(10, true)
    await fuente.alError(elemento)
    disparar('loadedmetadata')
    expect(elemento.play).not.toHaveBeenCalled()
  })

  it('un solo reintento si la URL nueva también falla', async () => {
    const pedirUrl = vi.fn<PedirUrl>().mockResolvedValue('u')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    const { elemento } = elementoFalso(10, false)
    expect(await fuente.alError(elemento)).toBe(true)
    expect(await fuente.alError(elemento)).toBe(false)
    expect(pedirUrl).toHaveBeenCalledTimes(2)
  })

  it('después de cargar bien, una nueva expiración vuelve a reintentar', async () => {
    const pedirUrl = vi.fn<PedirUrl>().mockResolvedValue('u')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    const { elemento, disparar } = elementoFalso(10, false)
    await fuente.alError(elemento)
    disparar('loadedmetadata')
    disparar('loadeddata')
    expect(await fuente.alError(elemento)).toBe(true)
    expect(pedirUrl).toHaveBeenCalledTimes(3)
  })

  it('falla si no se pudo pedir la URL o no hay archivo abierto', async () => {
    const pedirUrl = vi
      .fn<PedirUrl>()
      .mockResolvedValueOnce('u')
      .mockRejectedValueOnce(new Error('red'))
    const fuente = useFuenteFirmada(pedirUrl)
    const { elemento } = elementoFalso(0, true)
    expect(await fuente.alError(elemento)).toBe(false)
    await fuente.abrir(5)
    expect(await fuente.alError(elemento)).toBe(false)
  })

  it('si mientras tanto se abrió otro archivo, no toca la fuente', async () => {
    let entregar: (u: string) => void = () => undefined
    const pedirUrl = vi
      .fn<PedirUrl>()
      .mockResolvedValueOnce('u1')
      .mockImplementationOnce(() => new Promise<string>((resolve) => (entregar = resolve)))
      .mockResolvedValueOnce('otro')
    const fuente = useFuenteFirmada(pedirUrl)
    await fuente.abrir(5)
    const { elemento } = elementoFalso(10, false)
    const reintento = fuente.alError(elemento)
    await fuente.abrir(6)
    entregar('u2-viejo')
    await reintento
    expect(fuente.src.value).toBe('otro')
  })
})
