import type { Dinero, FechaIso, ParametrosPaginacion } from './api'

// Mismos límites que el backend (src/modules/productos/dto), para avisar
// antes de enviar. La validación que manda es la del servidor.
export const SKU_MAX = 50
export const DESCRIPCION_MAX = 2000
// Cantidades (stock mínimo, ajustes): la columna es INTEGER
export const CANTIDAD_MAXIMA = 1_000_000
// Decimal(12,2): hasta 10 dígitos enteros
export const DINERO_MAXIMO = 9_999_999_999.99
export const MOTIVO_MIN = 5
export const MOTIVO_MAX = 255

// Proveedor resumido que viene dentro de cada producto
export interface ProveedorDeProducto {
  id: number
  nombre: string
  telefono: string | null
}

export interface Producto {
  id: number
  // Se guarda en mayúsculas
  sku: string
  nombre: string
  descripcion: string | null
  precioVenta: Dinero
  // El backend NO lo envía al VENDEDOR: no asumir que existe
  costo?: Dinero
  stock: number
  stockMinimo: number
  proveedorId: number | null
  proveedor: ProveedorDeProducto | null
  activo: boolean
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

// GET /api/productos/stock-bajo: ordenado de mayor a menor faltante
export interface ProductoStockBajo extends Producto {
  // stockMinimo - stock
  faltante: number
}

// GET /api/productos (todos los roles). ?buscar= en nombre o SKU.
export interface ListarProductosParametros extends ParametrosPaginacion {
  buscar?: string
  proveedorId?: number
  // ADMIN y BODEGUERO; los demás reciben 403
  incluirInactivos?: boolean
}

// POST /api/productos (ADMIN, BODEGUERO). El stock nace en 0. Dinero como
// string con máximo 2 decimales. SKU repetido → 409 "SKU ya registrado";
// proveedor inactivo → 400.
export interface CrearProductoPeticion {
  sku: string
  nombre: string
  descripcion?: string | null
  precioVenta: Dinero
  costo: Dinero
  stockMinimo?: number
  // null = sin proveedor
  proveedorId?: number | null
}

// PATCH /api/productos/:id. Sin `stock` (el backend responde 400): el stock
// solo cambia por ventas y ajustes. Body vacío → 400.
export interface ActualizarProductoPeticion extends Partial<CrearProductoPeticion> {
  activo?: boolean
}

// POST /api/productos/:id/ajuste-stock. Positivo suma, negativo resta
// (distinto de 0). 409 "Stock insuficiente" si la salida es mayor al stock.
export interface AjusteStockPeticion {
  cantidad: number
  motivo: string
}
