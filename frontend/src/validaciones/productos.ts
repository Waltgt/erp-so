import { NOMBRE_ENTIDAD_MAX } from '@/types/contacto'
import type { Dinero } from '@/types/api'
import {
  CANTIDAD_MAXIMA,
  DESCRIPCION_MAX,
  DINERO_MAXIMO,
  MOTIVO_MAX,
  MOTIVO_MIN,
  SKU_MAX,
  type ActualizarProductoPeticion,
  type CrearProductoPeticion,
  type Producto,
} from '@/types/productos'
import type { Errores } from './comun'
import { opcional, soloCambios } from './contacto'

// Mismo patrón que el backend (IsSku), sobre el SKU ya en mayúsculas
const FORMATO_SKU = /^[A-Z0-9][A-Z0-9._/-]*$/

// Los montos se editan con InputNumber (number | null) y se envían como
// string con 2 decimales: el backend los guarda como Decimal(12,2). Number
// alcanza para representar exactamente un monto de 2 decimales en ese rango;
// el front no hace cálculos de dinero que se guarden.
export function aDinero(valor: number): Dinero {
  return valor.toFixed(2)
}

// "5999.99" → 5999.99 para el InputNumber (undefined: VENDEDOR, sin costo)
function deDinero(valor: Dinero | undefined): number | null {
  return valor === undefined ? null : Number(valor)
}

export interface FormularioProducto {
  sku: string
  nombre: string
  descripcion: string
  precioVenta: number | null
  costo: number | null
  stockMinimo: number | null
  proveedorId: number | null
}

export function formularioDeProducto(producto: Producto | null): FormularioProducto {
  return {
    sku: producto?.sku ?? '',
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    precioVenta: producto ? deDinero(producto.precioVenta) : null,
    costo: producto ? deDinero(producto.costo) : null,
    stockMinimo: producto?.stockMinimo ?? 0,
    proveedorId: producto?.proveedorId ?? null,
  }
}

function validarMonto(errores: Errores, campo: string, valor: number | null): void {
  if (valor === null) {
    errores[campo] = 'Escribe el monto'
  } else if (valor < 0 || valor > DINERO_MAXIMO) {
    errores[campo] = 'Monto fuera de rango'
  } else if (Math.abs(Math.round(valor * 100) - valor * 100) > 1e-6) {
    // Con tolerancia: 0.29 * 100 = 28.999999999999996 en coma flotante
    errores[campo] = 'Máximo 2 decimales'
  }
}

export function validarProducto(f: FormularioProducto): Errores {
  const errores: Errores = {}
  const sku = f.sku.trim().toUpperCase()
  if (sku === '') {
    errores.sku = 'Escribe el SKU'
  } else if (sku.length > SKU_MAX) {
    errores.sku = `Máximo ${SKU_MAX} caracteres`
  } else if (!FORMATO_SKU.test(sku)) {
    errores.sku = 'Solo letras, dígitos y los separadores - _ . / (sin espacios)'
  }
  const nombre = f.nombre.trim()
  if (nombre === '') {
    errores.nombre = 'Escribe el nombre'
  } else if (nombre.length > NOMBRE_ENTIDAD_MAX) {
    errores.nombre = `Máximo ${NOMBRE_ENTIDAD_MAX} caracteres`
  }
  if (f.descripcion.trim().length > DESCRIPCION_MAX) {
    errores.descripcion = `Máximo ${DESCRIPCION_MAX} caracteres`
  }
  validarMonto(errores, 'precioVenta', f.precioVenta)
  validarMonto(errores, 'costo', f.costo)
  if (
    f.stockMinimo !== null &&
    (!Number.isInteger(f.stockMinimo) || f.stockMinimo < 0 || f.stockMinimo > CANTIDAD_MAXIMA)
  ) {
    errores.stockMinimo = `Entero entre 0 y ${CANTIDAD_MAXIMA.toLocaleString('es-GT')}`
  }
  return errores
}

// POST /api/productos (llamar después de validarProducto: los montos no son null)
export function datosNuevoProducto(f: FormularioProducto): CrearProductoPeticion {
  return {
    sku: f.sku.trim(),
    nombre: f.nombre.trim(),
    descripcion: opcional(f.descripcion),
    precioVenta: aDinero(f.precioVenta!),
    costo: aDinero(f.costo!),
    stockMinimo: f.stockMinimo ?? 0,
    proveedorId: f.proveedorId,
  }
}

// PATCH /api/productos/:id: solo lo que cambió. El SKU y los montos se
// comparan normalizados ("lap-1" = "LAP-1"; "100" = "100.00").
export function cambiosDeProducto(
  original: Producto,
  f: FormularioProducto,
): ActualizarProductoPeticion {
  const nuevo = datosNuevoProducto(f)
  const comparable = {
    ...original,
    sku: original.sku,
    precioVenta: aDinero(Number(original.precioVenta)),
    costo: original.costo === undefined ? undefined : aDinero(Number(original.costo)),
  }
  return soloCambios(comparable, { ...nuevo, sku: nuevo.sku.toUpperCase() })
}

// ¿El cambio toca el precio? (para el aviso "no afecta ventas registradas")
export function cambiaPrecio(original: Producto, f: FormularioProducto): boolean {
  return f.precioVenta !== null && aDinero(f.precioVenta) !== aDinero(Number(original.precioVenta))
}

// Ajuste de stock: el usuario elige Entrada o Salida y una cantidad positiva;
// la salida se envía negativa
export type TipoAjuste = 'entrada' | 'salida'

export interface FormularioAjuste {
  tipo: TipoAjuste
  cantidad: number | null
  motivo: string
}

export function validarAjuste(f: FormularioAjuste): Errores {
  const errores: Errores = {}
  if (
    f.cantidad === null ||
    !Number.isInteger(f.cantidad) ||
    f.cantidad < 1 ||
    f.cantidad > CANTIDAD_MAXIMA
  ) {
    errores.cantidad = `Entero entre 1 y ${CANTIDAD_MAXIMA.toLocaleString('es-GT')}`
  }
  const motivo = f.motivo.trim()
  if (motivo.length < MOTIVO_MIN) {
    errores.motivo = `Al menos ${MOTIVO_MIN} caracteres`
  } else if (motivo.length > MOTIVO_MAX) {
    errores.motivo = `Máximo ${MOTIVO_MAX} caracteres`
  }
  return errores
}

export function cantidadFirmada(f: FormularioAjuste): number {
  const cantidad = f.cantidad ?? 0
  return f.tipo === 'salida' ? -cantidad : cantidad
}

// Lo que quedaría (puede ser negativo: el backend responde 409 y no se aplica)
export function stockResultante(stockActual: number, f: FormularioAjuste): number {
  return stockActual + cantidadFirmada(f)
}

// Stock en rojo: en o bajo el mínimo (la misma regla que stock-bajo)
export const esStockBajo = (p: Pick<Producto, 'stock' | 'stockMinimo'>): boolean =>
  p.stock <= p.stockMinimo
