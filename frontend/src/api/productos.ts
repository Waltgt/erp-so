import type { Paginado } from '@/types/api'
import { http } from './http'

// GET /api/productos/stock-bajo (ADMIN, BODEGUERO, COMPRAS). Solo interesa
// el total: se pide una fila. El resto de este archivo llega con 04-productos.
export async function contarStockBajo(): Promise<number> {
  const { data } = await http.get<Paginado<unknown>>('/productos/stock-bajo', {
    params: { page: 1, limit: 1 },
  })
  return data.total
}
