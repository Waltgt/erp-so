// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  actualizarCliente,
  crearCliente,
  desactivarCliente,
  listarClientes,
  obtenerCliente,
} from '../clientes'
import { http } from '../http'
import { listarVentas } from '../ventas'

describe('api de clientes y ventas', () => {
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

  it('listar: GET /clientes con búsqueda, paginación e incluirInactivos', async () => {
    await listarClientes({ page: 2, limit: 10, buscar: 'perez', incluirInactivos: true })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/clientes',
      params: { page: 2, limit: 10, buscar: 'perez', incluirInactivos: true },
    })
  })

  it('obtener: GET /clientes/:id', async () => {
    await obtenerCliente(4)
    expect(ultima()).toMatchObject({ metodo: 'get', ruta: '/clientes/4' })
  })

  it('crear: POST /clientes con el body', async () => {
    const datos = { nit: 'CF', nombre: 'Juan Pérez', email: null }
    await crearCliente(datos)
    expect(ultima()).toMatchObject({ metodo: 'post', ruta: '/clientes', body: datos })
  })

  it('actualizar: PATCH /clientes/:id solo con lo enviado (null borra)', async () => {
    await actualizarCliente(4, { telefono: null, activo: true })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/clientes/4',
      body: { telefono: null, activo: true },
    })
  })

  it('desactivar: DELETE /clientes/:id', async () => {
    await desactivarCliente(4)
    expect(ultima()).toMatchObject({ metodo: 'delete', ruta: '/clientes/4' })
  })

  it('ventas de un cliente: GET /ventas?clienteId=', async () => {
    await listarVentas({ clienteId: 4, page: 1, limit: 5 })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/ventas',
      params: { clienteId: 4, page: 1, limit: 5 },
    })
  })
})
