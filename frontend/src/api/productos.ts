import type { Paginado, ParametrosPaginacion } from '@/types/api'
import type {
  ActualizarProductoPeticion,
  AjusteStockPeticion,
  CrearProductoPeticion,
  ListarProductosParametros,
  Producto,
  ProductoStockBajo,
} from '@/types/productos'
import { http } from './http'

// Leer: todos los roles (VENDEDOR sin costo). Escribir y ajustar stock: ADMIN
// y BODEGUERO.

export async function listarProductos(
  parametros: ListarProductosParametros = {},
): Promise<Paginado<Producto>> {
  const { data } = await http.get<Paginado<Producto>>('/productos', { params: parametros })
  return data
}

// ADMIN, BODEGUERO y COMPRAS
export async function listarStockBajo(
  parametros: ParametrosPaginacion = {},
): Promise<Paginado<ProductoStockBajo>> {
  const { data } = await http.get<Paginado<ProductoStockBajo>>('/productos/stock-bajo', {
    params: parametros,
  })
  return data
}

// Para la tarjeta del inicio: solo interesa el total, se pide una fila
export async function contarStockBajo(): Promise<number> {
  return (await listarStockBajo({ page: 1, limit: 1 })).total
}

export async function obtenerProducto(id: number): Promise<Producto> {
  const { data } = await http.get<Producto>(`/productos/${id}`)
  return data
}

export async function crearProducto(datos: CrearProductoPeticion): Promise<Producto> {
  const { data } = await http.post<Producto>('/productos', datos)
  return data
}

export async function actualizarProducto(
  id: number,
  datos: ActualizarProductoPeticion,
): Promise<Producto> {
  const { data } = await http.patch<Producto>(`/productos/${id}`, datos)
  return data
}

// Borrado lógico (200 con el producto ya inactivo)
export async function desactivarProducto(id: number): Promise<Producto> {
  const { data } = await http.delete<Producto>(`/productos/${id}`)
  return data
}

// Atómico en el backend. Responde el producto con el stock resultante.
export async function ajustarStock(id: number, datos: AjusteStockPeticion): Promise<Producto> {
  const { data } = await http.post<Producto>(`/productos/${id}/ajuste-stock`, datos)
  return data
}
