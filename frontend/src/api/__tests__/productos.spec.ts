// @vitest-environment node
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { http } from '../http'
import {
  actualizarProducto,
  ajustarStock,
  contarStockBajo,
  crearProducto,
  desactivarProducto,
  listarProductos,
  listarStockBajo,
  obtenerProducto,
} from '../productos'

describe('api de productos', () => {
  let peticiones: InternalAxiosRequestConfig[]

  beforeEach(() => {
    peticiones = []
    http.defaults.adapter = (config) => {
      peticiones.push(config)
      return Promise.resolve({
        data: { data: [], total: 4, page: 1, limit: 1 },
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

  it('listar: GET /productos con búsqueda y proveedor', async () => {
    await listarProductos({ page: 1, limit: 20, buscar: 'lap', proveedorId: 3 })
    expect(ultima()).toMatchObject({
      metodo: 'get',
      ruta: '/productos',
      params: { page: 1, limit: 20, buscar: 'lap', proveedorId: 3 },
    })
  })

  it('stock bajo: GET /productos/stock-bajo; contar pide una fila', async () => {
    await listarStockBajo({ page: 2, limit: 10 })
    expect(ultima()).toMatchObject({
      ruta: '/productos/stock-bajo',
      params: { page: 2, limit: 10 },
    })
    await expect(contarStockBajo()).resolves.toBe(4)
    expect(ultima()).toMatchObject({ params: { page: 1, limit: 1 } })
  })

  it('obtener, crear, actualizar y desactivar', async () => {
    await obtenerProducto(5)
    expect(ultima()).toMatchObject({ metodo: 'get', ruta: '/productos/5' })

    const datos = { sku: 'LAP-1', nombre: 'Laptop', precioVenta: '10.50', costo: '7.00' }
    await crearProducto(datos)
    expect(ultima()).toMatchObject({ metodo: 'post', ruta: '/productos', body: datos })

    await actualizarProducto(5, { precioVenta: '12.00' })
    expect(ultima()).toMatchObject({
      metodo: 'patch',
      ruta: '/productos/5',
      body: { precioVenta: '12.00' },
    })

    await desactivarProducto(5)
    expect(ultima()).toMatchObject({ metodo: 'delete', ruta: '/productos/5' })
  })

  it('ajuste de stock: POST /productos/:id/ajuste-stock', async () => {
    await ajustarStock(5, { cantidad: -3, motivo: 'Producto dañado' })
    expect(ultima()).toMatchObject({
      metodo: 'post',
      ruta: '/productos/5/ajuste-stock',
      body: { cantidad: -3, motivo: 'Producto dañado' },
    })
  })
})
