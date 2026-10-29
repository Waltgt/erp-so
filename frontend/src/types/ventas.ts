import type { Dinero, FechaIso, ParametrosPaginacion } from './api'

// Enum EstadoVenta del backend
export const ESTADOS_VENTA = ['COMPLETADA', 'ANULADA'] as const
export type EstadoVenta = (typeof ESTADOS_VENTA)[number]

// Mismos límites que el backend (src/modules/ventas/dto)
export const ITEMS_MAXIMOS = 50
export const MOTIVO_ANULACION_MIN = 5
export const MOTIVO_ANULACION_MAX = 255

// Elemento de GET /api/ventas (sin los detalles)
export interface VentaResumen {
  // Funciona como correlativo
  id: number
  clienteId: number
  usuarioId: number
  fecha: FechaIso
  // Oficial: lo calcula el backend con Decimal
  total: Dinero
  estado: EstadoVenta
  anuladaEn: FechaIso | null
  motivoAnulacion: string | null
  cliente: { id: number; nit: string; nombre: string }
  // Vendedor (el usuario del token al registrar)
  usuario: { id: number; nombre: string; email: string }
}

export interface DetalleVenta {
  id: number
  productoId: number
  cantidad: number
  // Copia del precio al momento de vender
  precioUnitario: Dinero
  subtotal: Dinero
  producto: { id: number; sku: string; nombre: string }
}

// GET /:id, POST y anular
export interface VentaDetalle extends VentaResumen {
  detalles: DetalleVenta[]
}

// GET /api/ventas (ADMIN, VENDEDOR). Más recientes primero. Un VENDEDOR
// recibe solo sus ventas (lo filtra el backend).
export interface ListarVentasParametros extends ParametrosPaginacion {
  // "AAAA-MM-DD" (día completo en Guatemala) o ISO 8601 con zona. desde >
  // hasta → 400.
  desde?: string
  hasta?: string
  clienteId?: number
  estado?: EstadoVenta
}

// POST /api/ventas (ADMIN, VENDEDOR). SOLO productoId y cantidad: el precio
// lo lee el backend (un precio en el body da 400). Sin productoId repetidos.
// 409 si un producto no alcanza, está inactivo o no existe: el mensaje trae
// "(id N)" o "El producto N no existe".
export interface CrearVentaPeticion {
  clienteId: number
  items: { productoId: number; cantidad: number }[]
}

// POST /api/ventas/:id/anular (ADMIN). 409 si ya estaba anulada.
export interface AnularVentaPeticion {
  motivo: string
}
