// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { http } from '../http'
import { anularVenta, crearVenta, listarVentas, obtenerVenta } from '../ventas'

describe('api de ventas', () => {
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

  const ultima = () => {
    const p = peticiones[peticiones.length - 1]!
    return {
      metodo: p.method,
      ruta: p.url,
      params: p.params as unknown,
      body: typeof p.data === 'string' ? (JSON.parse(p.data) as unknown) : undefined,
    }
  }

  it('listar: GET /ventas con fechas, cliente y estado', async () => {
    await listarVentas({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      clienteId: 2,
      estado: 'ANULADA',
    })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/ventas',
      params: { desde: '2026-10-01', hasta: '2026-10-31', clienteId: 2, estado: 'ANULADA' },
    })
  })

  it('obtener: GET /ventas/:id', async () => {
    await obtenerVenta(25)
    expect(ultima()).toMatchObject({ metodo: 'get', ruta: '/ventas/25' })
  })

  it('crear: POST /ventas solo con clienteId e items (sin precios)', async () => {
    const datos = { clienteId: 1, items: [{ productoId: 3, cantidad: 2 }] }
    await crearVenta(datos)
    expect(ultima()).toEqual({ metodo: 'post', ruta: '/ventas', params: undefined, body: datos })
  })

  it('anular: POST /ventas/:id/anular con el motivo', async () => {
    await anularVenta(25, { motivo: 'Devolución' })
    expect(ultima()).toMatchObject({
      metodo: 'post',
      ruta: '/ventas/25/anular',
      body: { motivo: 'Devolución' },
    })
  })
})
