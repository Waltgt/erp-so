// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { http } from '../http'
import {
  actualizarProveedor,
  crearProveedor,
  desactivarProveedor,
  listarProveedores,
  obtenerProveedor,
} from '../proveedores'

describe('api de proveedores', () => {
  let peticiones: InternalAxiosRequestConfig[]

  beforeEach(() => {
    peticiones = []
    http.defaults.adapter = (config) => {
      peticiones.push(config)
      return Promise.resolve({
        data: { data: [], total: 0, page: 1, limit: 20 },
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

  const ultima = () => {
    const p = peticiones[peticiones.length - 1]!
    return {
      metodo: p.method,
      ruta: p.url,
      params: p.params as unknown,
      body: typeof p.data === 'string' ? (JSON.parse(p.data) as unknown) : undefined,
    }
  }

  it('listar: GET /proveedores con búsqueda, paginación e incluirInactivos', async () => {
    await listarProveedores({ page: 1, limit: 20, buscar: 'sol', incluirInactivos: true })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/proveedores',
      params: { page: 1, limit: 20, buscar: 'sol', incluirInactivos: true },
    })
  })

  it('obtener: GET /proveedores/:id', async () => {
    await obtenerProveedor(3)
    expect(ultima()).toMatchObject({ metodo: 'get', ruta: '/proveedores/3' })
  })

  it('crear: POST /proveedores con el body', async () => {
    const datos = { nit: '12345678', nombre: 'El Sol', contacto: 'María' }
    await crearProveedor(datos)
    expect(ultima()).toMatchObject({ metodo: 'post', ruta: '/proveedores', body: datos })
  })

  it('actualizar: PATCH /proveedores/:id (activo: true reactiva)', async () => {
    await actualizarProveedor(3, { activo: true })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/proveedores/3',
      body: { activo: true },
    })
  })

  it('desactivar: DELETE /proveedores/:id', async () => {
    await desactivarProveedor(3)
    expect(ultima()).toMatchObject({ metodo: 'delete', ruta: '/proveedores/3' })
  })
})
