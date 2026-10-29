import type { Paginado } from '@/types/api'
import type {
  AnularVentaPeticion,
  CrearVentaPeticion,
  ListarVentasParametros,
  VentaDetalle,
  VentaResumen,
} from '@/types/ventas'
import { http } from './http'

// /api/ventas: ADMIN y VENDEDOR. Anular: solo ADMIN.

export async function listarVentas(
  parametros: ListarVentasParametros = {},
): Promise<Paginado<VentaResumen>> {
  const { data } = await http.get<Paginado<VentaResumen>>('/ventas', { params: parametros })
  return data
}

// VENDEDOR pidiendo una venta ajena: 404
export async function obtenerVenta(id: number): Promise<VentaDetalle> {
  const { data } = await http.get<VentaDetalle>(`/ventas/${id}`)
  return data
}

// 201 con la venta registrada (su total es el oficial)
export async function crearVenta(datos: CrearVentaPeticion): Promise<VentaDetalle> {
  const { data } = await http.post<VentaDetalle>('/ventas', datos)
  return data
}

// Devuelve el stock en el backend. 200 con la venta anulada.
export async function anularVenta(id: number, datos: AnularVentaPeticion): Promise<VentaDetalle> {
  const { data } = await http.post<VentaDetalle>(`/ventas/${id}/anular`, datos)
  return data
}
