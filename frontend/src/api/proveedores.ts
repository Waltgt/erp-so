import type { Paginado } from '@/types/api'
import type {
  ActualizarProveedorPeticion,
  CrearProveedorPeticion,
  ListarProveedoresParametros,
  Proveedor,
  ProveedorConProductos,
} from '@/types/proveedores'
import { http } from './http'

// Leer: ADMIN, COMPRAS y BODEGUERO. Escribir: ADMIN y COMPRAS.

export async function listarProveedores(
  parametros: ListarProveedoresParametros = {},
): Promise<Paginado<ProveedorConProductos>> {
  const { data } = await http.get<Paginado<ProveedorConProductos>>('/proveedores', {
    params: parametros,
  })
  return data
}

export async function obtenerProveedor(id: number): Promise<ProveedorConProductos> {
  const { data } = await http.get<ProveedorConProductos>(`/proveedores/${id}`)
  return data
}

export async function crearProveedor(datos: CrearProveedorPeticion): Promise<Proveedor> {
  const { data } = await http.post<Proveedor>('/proveedores', datos)
  return data
}

// La respuesta no trae productosActivos
export async function actualizarProveedor(
  id: number,
  datos: ActualizarProveedorPeticion,
): Promise<Proveedor> {
  const { data } = await http.patch<Proveedor>(`/proveedores/${id}`, datos)
  return data
}

// Borrado lógico: se permite aunque tenga productos activos, y la respuesta
// dice cuántos quedan asociados (para avisar)
export async function desactivarProveedor(id: number): Promise<ProveedorConProductos> {
  const { data } = await http.delete<ProveedorConProductos>(`/proveedores/${id}`)
  return data
}
