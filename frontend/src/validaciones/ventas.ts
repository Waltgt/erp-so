import type { Dinero } from '@/types/api'
import type { Producto } from '@/types/productos'
import {
  ITEMS_MAXIMOS,
  MOTIVO_ANULACION_MAX,
  MOTIVO_ANULACION_MIN,
  type CrearVentaPeticion,
} from '@/types/ventas'
import type { Errores } from './comun'

// ─── Dinero en centavos ─────────────────────────────────────────────
// El total de la pantalla es solo una ESTIMACIÓN (el oficial lo calcula el
// backend con Decimal). Se calcula en centavos enteros para que 3 × 19.99
// dé 59.97 exacto. BigInt: precio (hasta ~1e12 centavos) × cantidad (hasta
// 1e6) no cabe en un Number sin perder precisión.

// "19.99" → 1999n, "100" → 10000n (Decimal serializa sin ceros finales).
// Se lee el texto, sin pasar por coma flotante.
export function centavosDe(valor: Dinero): bigint {
  const [entero = '0', decimales = ''] = valor.split('.')
  return BigInt(entero) * 100n + BigInt((decimales + '00').slice(0, 2))
}

// 5997n → "59.97" (para formatoDinero)
export function dineroDeCentavos(centavos: bigint): Dinero {
  const resto = (centavos % 100n).toString().padStart(2, '0')
  return `${centavos / 100n}.${resto}`
}

// ─── Líneas de la venta ─────────────────────────────────────────────
export type ProductoDeLinea = Pick<Producto, 'id' | 'sku' | 'nombre' | 'precioVenta' | 'stock'>

export interface LineaVenta {
  producto: ProductoDeLinea
  cantidad: number
  // Error del backend para esta línea (409: stock insuficiente, inactivo)
  error: string | null
}

export interface ResultadoAgregar {
  lineas: LineaVenta[]
  // Por qué no se agregó o no se sumó (para un Toast)
  aviso: string | null
}

// Un producto que ya está en la lista suma 1 a su cantidad: el backend
// rechaza productoId repetidos
export function agregarProducto(lineas: LineaVenta[], producto: ProductoDeLinea): ResultadoAgregar {
  const existente = lineas.find((l) => l.producto.id === producto.id)
  if (existente) {
    if (existente.cantidad >= producto.stock) {
      return { lineas, aviso: `Solo hay ${producto.stock} en stock de ${producto.nombre}` }
    }
    return {
      lineas: lineas.map((l) =>
        l === existente ? { producto, cantidad: l.cantidad + 1, error: null } : l,
      ),
      aviso: null,
    }
  }
  if (lineas.length >= ITEMS_MAXIMOS) {
    return { lineas, aviso: `Una venta admite como máximo ${ITEMS_MAXIMOS} productos distintos` }
  }
  if (producto.stock < 1) {
    return { lineas, aviso: `${producto.nombre} no tiene stock` }
  }
  return { lineas: [...lineas, { producto, cantidad: 1, error: null }], aviso: null }
}

export function subtotalCentavos(linea: LineaVenta): bigint {
  return centavosDe(linea.producto.precioVenta) * BigInt(linea.cantidad)
}

export function totalEstimadoCentavos(lineas: readonly LineaVenta[]): bigint {
  return lineas.reduce((suma, l) => suma + subtotalCentavos(l), 0n)
}

export function validarVenta(clienteId: number | null, lineas: readonly LineaVenta[]): Errores {
  const errores: Errores = {}
  if (clienteId === null) {
    errores.cliente = 'Elige un cliente'
  }
  if (lineas.length === 0) {
    errores.lineas = 'Agrega al menos un producto'
  } else if (lineas.length > ITEMS_MAXIMOS) {
    errores.lineas = `Máximo ${ITEMS_MAXIMOS} productos distintos`
  } else if (
    lineas.some(
      (l) => !Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > l.producto.stock,
    )
  ) {
    errores.lineas = 'Revisa las cantidades: entre 1 y el stock disponible'
  }
  return errores
}

// Lo único que se envía: nunca precios ni totales
export function peticionVenta(
  clienteId: number,
  lineas: readonly LineaVenta[],
): CrearVentaPeticion {
  return {
    clienteId,
    items: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
  }
}

// El 409 del backend nombra el producto: "Stock insuficiente para LAP-1 (id
// 3): ...", "El producto LAP-1 (id 3) está inactivo" o "El producto 3 no
// existe"
export function productoDelConflicto(mensaje: string): number | null {
  const id = /\(id (\d+)\)/.exec(mensaje)?.[1] ?? /^El producto (\d+) no existe$/.exec(mensaje)?.[1]
  return id ? Number(id) : null
}

// ─── Anulación ──────────────────────────────────────────────────────
export function validarAnulacion(motivo: string): Errores {
  const largo = motivo.trim().length
  if (largo < MOTIVO_ANULACION_MIN) {
    return { motivo: `Al menos ${MOTIVO_ANULACION_MIN} caracteres` }
  }
  if (largo > MOTIVO_ANULACION_MAX) {
    return { motivo: `Máximo ${MOTIVO_ANULACION_MAX} caracteres` }
  }
  return {}
}

// ─── Filtro de fechas ───────────────────────────────────────────────
// El DatePicker da el día elegido a medianoche LOCAL: se toma esa fecha de
// calendario ("AAAA-MM-DD") y el backend la interpreta como el día completo
// en Guatemala
export function diaDe(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}
