// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Producto } from '@/types/productos'
import {
  aDinero,
  cambiaPrecio,
  cambiosDeProducto,
  cantidadFirmada,
  datosNuevoProducto,
  esStockBajo,
  formularioDeProducto,
  stockResultante,
  validarAjuste,
  validarProducto,
  type FormularioProducto,
} from '../productos'

const laptop: Producto = {
  id: 1,
  sku: 'LAP-001',
  nombre: 'Laptop 14"',
  descripcion: null,
  // Decimal serializa "100.00" como "100"
  precioVenta: '5999.9',
  costo: '4500',
  stock: 2,
  stockMinimo: 5,
  proveedorId: 3,
  proveedor: { id: 3, nombre: 'El Sol', telefono: null },
  activo: true,
  creadoEn: '2026-10-01T00:00:00.000Z',
  actualizadoEn: '2026-10-01T00:00:00.000Z',
}

const valido: FormularioProducto = {
  sku: 'lap-002',
  nombre: 'Mouse',
  descripcion: '',
  precioVenta: 120.5,
  costo: 80,
  stockMinimo: 3,
  proveedorId: null,
}

describe('dinero', () => {
  it('se envía como string con 2 decimales', () => {
    expect(aDinero(120.5)).toBe('120.50')
    expect(aDinero(0.1 + 0.2)).toBe('0.30')
  })
})

describe('validarProducto', () => {
  it('válido (el SKU se valida en mayúsculas)', () => {
    expect(validarProducto(valido)).toEqual({})
  })

  it('0.29 tiene 2 decimales aunque 0.29 * 100 no sea exacto en coma flotante', () => {
    expect(validarProducto({ ...valido, precioVenta: 0.29, costo: 1.15 })).toEqual({})
  })

  it.each([
    ['SKU vacío', { sku: ' ' }, 'sku'],
    ['SKU con espacios', { sku: 'LAP 1' }, 'sku'],
    ['SKU de más de 50', { sku: 'A'.repeat(51) }, 'sku'],
    ['nombre vacío', { nombre: '' }, 'nombre'],
    ['sin precio', { precioVenta: null }, 'precioVenta'],
    ['precio negativo', { precioVenta: -1 }, 'precioVenta'],
    ['costo con 3 decimales', { costo: 1.234 }, 'costo'],
    ['stock mínimo decimal', { stockMinimo: 1.5 }, 'stockMinimo'],
    ['stock mínimo negativo', { stockMinimo: -1 }, 'stockMinimo'],
  ])('rechaza %s', (_caso, cambio, campo) => {
    expect(validarProducto({ ...valido, ...cambio })).toHaveProperty(campo)
  })
})

describe('datos para la API', () => {
  it('crear: montos como string, descripción vacía como null', () => {
    expect(datosNuevoProducto(valido)).toEqual({
      sku: 'lap-002',
      nombre: 'Mouse',
      descripcion: null,
      precioVenta: '120.50',
      costo: '80.00',
      stockMinimo: 3,
      proveedorId: null,
    })
  })

  it('editar sin cambios: body vacío ("5999.9" = 5999.90, sku en mayúsculas)', () => {
    const f = { ...formularioDeProducto(laptop), sku: 'lap-001' }
    expect(cambiosDeProducto(laptop, f)).toEqual({})
    expect(cambiaPrecio(laptop, f)).toBe(false)
  })

  it('editar: solo el precio y el proveedor (null = sin proveedor)', () => {
    const f = { ...formularioDeProducto(laptop), precioVenta: 6500, proveedorId: null }
    expect(cambiosDeProducto(laptop, f)).toEqual({ precioVenta: '6500.00', proveedorId: null })
    expect(cambiaPrecio(laptop, f)).toBe(true)
  })

  it('el formulario nunca lleva stock', () => {
    expect(datosNuevoProducto(formularioDeProducto(laptop))).not.toHaveProperty('stock')
  })
})

describe('ajuste de stock', () => {
  it('la salida se envía negativa; el resultante puede quedar negativo', () => {
    const salida = { tipo: 'salida' as const, cantidad: 5, motivo: 'Producto dañado' }
    expect(cantidadFirmada(salida)).toBe(-5)
    expect(stockResultante(2, salida)).toBe(-3)
    expect(stockResultante(2, { ...salida, tipo: 'entrada' })).toBe(7)
  })

  it('cantidad entera > 0 y motivo de 5 a 255', () => {
    expect(validarAjuste({ tipo: 'entrada', cantidad: 1, motivo: 'Compra' })).toEqual({})
    expect(
      Object.keys(validarAjuste({ tipo: 'salida', cantidad: 0, motivo: ' abc ' })).sort(),
    ).toEqual(['cantidad', 'motivo'])
    expect(validarAjuste({ tipo: 'salida', cantidad: 2.5, motivo: 'x'.repeat(256) })).toEqual({
      cantidad: expect.any(String),
      motivo: expect.any(String),
    })
  })

  it('stock bajo: stock <= mínimo', () => {
    expect(esStockBajo({ stock: 2, stockMinimo: 5 })).toBe(true)
    expect(esStockBajo({ stock: 5, stockMinimo: 5 })).toBe(true)
    expect(esStockBajo({ stock: 6, stockMinimo: 5 })).toBe(false)
  })
})
