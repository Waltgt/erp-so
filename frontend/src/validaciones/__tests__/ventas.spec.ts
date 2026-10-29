// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatoDinero } from '@/composables/useFormato'
import {
  agregarProducto,
  centavosDe,
  diaDe,
  dineroDeCentavos,
  peticionVenta,
  productoDelConflicto,
  totalEstimadoCentavos,
  validarAnulacion,
  validarVenta,
  type LineaVenta,
  type ProductoDeLinea,
} from '../ventas'

const cable: ProductoDeLinea = {
  id: 3,
  sku: 'CAB-1',
  nombre: 'Cable',
  precioVenta: '19.99',
  stock: 5,
}
const mouse: ProductoDeLinea = {
  id: 7,
  sku: 'MOU-1',
  nombre: 'Mouse',
  precioVenta: '100',
  stock: 1,
}

describe('centavos', () => {
  it('lee el texto sin coma flotante', () => {
    expect(centavosDe('19.99')).toBe(1999n)
    expect(centavosDe('100')).toBe(10000n)
    expect(centavosDe('0.5')).toBe(50n)
    expect(centavosDe('9999999999.99')).toBe(999999999999n)
  })

  it('vuelve a texto con 2 decimales', () => {
    expect(dineroDeCentavos(5997n)).toBe('59.97')
    expect(dineroDeCentavos(5n)).toBe('0.05')
    expect(dineroDeCentavos(0n)).toBe('0.00')
  })

  it('3 × Q19.99 = Q59.97 exacto (criterio de aceptación)', () => {
    const lineas: LineaVenta[] = [{ producto: cable, cantidad: 3, error: null }]
    const total = totalEstimadoCentavos(lineas)
    expect(total).toBe(5997n)
    expect(dineroDeCentavos(total)).toBe('59.97')
    expect(formatoDinero(dineroDeCentavos(total))).toMatch(/^Q\s?59\.97$/)
    // En coma flotante otros montos sí fallan: 1.15 × 3 = 3.4499999999999997
    expect(1.15 * 3).not.toBe(3.45)
    expect(dineroDeCentavos(centavosDe('1.15') * 3n)).toBe('3.45')
  })

  it('no pierde precisión con montos y cantidades grandes', () => {
    const caro = { ...cable, precioVenta: '9999999.99', stock: 1_000_000 }
    expect(totalEstimadoCentavos([{ producto: caro, cantidad: 1_000_000, error: null }])).toBe(
      999999999000000n,
    )
  })
})

describe('agregarProducto', () => {
  it('el mismo producto dos veces: una sola línea con cantidad 2', () => {
    const primera = agregarProducto([], cable).lineas
    const segunda = agregarProducto(primera, cable)
    expect(segunda.lineas).toHaveLength(1)
    expect(segunda.lineas[0]).toMatchObject({ cantidad: 2 })
    expect(segunda.aviso).toBeNull()
  })

  it('no supera el stock ni agrega productos sin stock', () => {
    const conMouse = agregarProducto([], mouse).lineas
    const otraVez = agregarProducto(conMouse, mouse)
    expect(otraVez.lineas[0]).toMatchObject({ cantidad: 1 })
    expect(otraVez.aviso).toContain('Solo hay 1')

    expect(agregarProducto([], { ...cable, stock: 0 })).toMatchObject({
      lineas: [],
      aviso: expect.stringContaining('no tiene stock'),
    })
  })

  it('máximo 50 líneas', () => {
    let lineas: LineaVenta[] = []
    for (let id = 1; id <= 50; id++) {
      lineas = agregarProducto(lineas, { ...cable, id }).lineas
    }
    const resultado = agregarProducto(lineas, { ...cable, id: 51 })
    expect(resultado.lineas).toHaveLength(50)
    expect(resultado.aviso).toContain('50')
  })

  it('al sumar se limpia el error de la línea', () => {
    const lineas: LineaVenta[] = [{ producto: cable, cantidad: 1, error: 'Stock insuficiente' }]
    expect(agregarProducto(lineas, cable).lineas[0]!.error).toBeNull()
  })
})

describe('validarVenta y petición', () => {
  it('cliente y al menos una línea con cantidad válida', () => {
    expect(Object.keys(validarVenta(null, []))).toEqual(['cliente', 'lineas'])
    expect(validarVenta(1, [{ producto: mouse, cantidad: 2, error: null }])).toHaveProperty(
      'lineas',
    )
    expect(validarVenta(1, [{ producto: cable, cantidad: 2, error: null }])).toEqual({})
  })

  it('solo clienteId, productoId y cantidad (nunca precios)', () => {
    const lineas: LineaVenta[] = [{ producto: cable, cantidad: 3, error: null }]
    expect(peticionVenta(9, lineas)).toEqual({
      clienteId: 9,
      items: [{ productoId: 3, cantidad: 3 }],
    })
  })
})

describe('productoDelConflicto', () => {
  it.each([
    ['Stock insuficiente para CAB-1 (id 3): disponible 1, solicitado 3', 3],
    ['El producto CAB-1 (id 12) está inactivo', 12],
    ['El producto 44 no existe', 44],
    ['La venta no existe o ya fue anulada', null],
  ])('"%s" → %s', (mensaje, id) => {
    expect(productoDelConflicto(mensaje)).toBe(id)
  })
})

describe('otros', () => {
  it('motivo de anulación de 5 a 255 (recortado)', () => {
    expect(validarAnulacion('  abc  ')).toHaveProperty('motivo')
    expect(validarAnulacion('x'.repeat(256))).toHaveProperty('motivo')
    expect(validarAnulacion('Devolución')).toEqual({})
  })

  it('diaDe usa la fecha de calendario local', () => {
    expect(diaDe(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(diaDe(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31')
  })
})
