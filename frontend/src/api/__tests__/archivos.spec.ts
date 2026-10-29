// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  actualizarArchivo,
  actualizarCarpeta,
  borrarArchivo,
  borrarCarpeta,
  contenidoCarpeta,
  crearCarpeta,
  listarArchivos,
  subirArchivo,
  urlArchivo,
} from '../archivos'
import { http } from '../http'

describe('api de archivos y carpetas', () => {
  let peticiones: InternalAxiosRequestConfig[]

  beforeEach(() => {
    peticiones = []
    http.defaults.adapter = (config) => {
      peticiones.push(config)
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: '',
        headers: new AxiosHeaders(),
        config,
      })
    }
  })

  afterEach(() => {
    http.defaults.adapter = undefined
  })

  const ultima = () => peticiones[peticiones.length - 1]!

  it('contenido: raíz sin parentId; carpeta con parentId', async () => {
    await contenidoCarpeta(null)
    expect(ultima()).toMatchObject({ method: 'get', url: '/carpetas', params: {} })
    await contenidoCarpeta(4)
    expect(ultima()).toMatchObject({ params: { parentId: 4 } })
  })

  it('carpetas: crear, mover a la raíz y borrar', async () => {
    await crearCarpeta({ nombre: 'Rock', parentId: null })
    expect(ultima()).toMatchObject({ method: 'post', url: '/carpetas' })
    expect(JSON.parse(ultima().data as string)).toEqual({ nombre: 'Rock', parentId: null })

    await actualizarCarpeta(4, { parentId: null })
    expect(ultima()).toMatchObject({ method: 'patch', url: '/carpetas/4' })
    expect(JSON.parse(ultima().data as string)).toEqual({ parentId: null })

    await borrarCarpeta(4)
    expect(ultima()).toMatchObject({ method: 'delete', url: '/carpetas/4' })
  })

  it('listar: GET /archivos con filtros (usuarioId para ADMIN)', async () => {
    await listarArchivos({ tipo: 'MUSICA', buscar: 'rock', usuarioId: 2, page: 1, limit: 20 })
    expect(ultima()).toMatchObject({
      method: 'get',
      url: '/archivos',
      params: { tipo: 'MUSICA', buscar: 'rock', usuarioId: 2, page: 1, limit: 20 },
    })
  })

  it('subir: multipart con carpetaId ANTES del archivo y sin timeout', async () => {
    const archivo = new File(['abc'], 'canción.mp3', { type: 'audio/mpeg' })
    await subirArchivo(archivo, 7)
    const p = ultima()
    expect(p).toMatchObject({ method: 'post', url: '/archivos', timeout: 0 })
    const campos = [...(p.data as FormData).keys()]
    expect(campos).toEqual(['carpetaId', 'archivo'])
    expect((p.data as FormData).get('carpetaId')).toBe('7')
    expect(((p.data as FormData).get('archivo') as File).name).toBe('canción.mp3')
  })

  it('subir a la raíz: sin carpetaId', async () => {
    await subirArchivo(new File(['a'], 'a.txt', { type: 'text/plain' }), null)
    expect([...(ultima().data as FormData).keys()]).toEqual(['archivo'])
  })

  it('archivos: renombrar, borrar y URL firmada por modo', async () => {
    await actualizarArchivo(9, { nombreOriginal: 'nuevo.mp3' })
    expect(ultima()).toMatchObject({ method: 'patch', url: '/archivos/9' })

    await borrarArchivo(9)
    expect(ultima()).toMatchObject({ method: 'delete', url: '/archivos/9' })

    await urlArchivo(9, 'descargar')
    expect(ultima()).toMatchObject({
      method: 'get',
      url: '/archivos/9/url',
      params: { modo: 'descargar' },
    })
  })
})
