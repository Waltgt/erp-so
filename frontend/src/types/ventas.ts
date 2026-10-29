import type { Dinero, FechaIso, ParametrosPaginacion } from './api'

// Enum EstadoVenta del backend. El resto de los tipos llega con 05-ventas.
export const ESTADOS_VENTA = ['COMPLETADA', 'ANULADA'] as const
export type EstadoVenta = (typeof ESTADOS_VENTA)[number]

// Elemento de GET /api/ventas (sin los detalles)
export interface VentaResumen {
  id: number
  clienteId: number
  usuarioId: number
  fecha: FechaIso
  total: Dinero
  estado: EstadoVenta
  anuladaEn: FechaIso | null
  motivoAnulacion: string | null
  cliente: { id: number; nit: string; nombre: string }
  usuario: { id: number; nombre: string; email: string }
}

// GET /api/ventas (ADMIN, VENDEDOR). Ordenado de la más reciente a la más
// antigua. Un VENDEDOR recibe solo sus ventas (lo filtra el backend).
export interface ListarVentasParametros extends ParametrosPaginacion {
  // "AAAA-MM-DD" (día completo en Guatemala) o ISO 8601 con zona
  desde?: string
  hasta?: string
  clienteId?: number
  estado?: EstadoVenta
}
