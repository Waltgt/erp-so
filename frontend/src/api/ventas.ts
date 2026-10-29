import type { Paginado } from '@/types/api'
import type { ListarVentasParametros, VentaResumen } from '@/types/ventas'
import { http } from './http'

// GET /api/ventas (ADMIN, VENDEDOR). El resto de este archivo llega con
// 05-ventas.
export async function listarVentas(
  parametros: ListarVentasParametros = {},
): Promise<Paginado<VentaResumen>> {
  const { data } = await http.get<Paginado<VentaResumen>>('/ventas', { params: parametros })
  return data
}
