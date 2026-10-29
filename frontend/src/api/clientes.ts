import type { Paginado } from '@/types/api'
import type {
  ActualizarClientePeticion,
  Cliente,
  CrearClientePeticion,
  ListarClientesParametros,
} from '@/types/clientes'
import { http } from './http'

// /api/clientes es para ADMIN y VENDEDOR; desactivar es solo ADMIN

export async function listarClientes(
  parametros: ListarClientesParametros = {},
): Promise<Paginado<Cliente>> {
  const { data } = await http.get<Paginado<Cliente>>('/clientes', { params: parametros })
  return data
}

// También devuelve clientes inactivos
export async function obtenerCliente(id: number): Promise<Cliente> {
  const { data } = await http.get<Cliente>(`/clientes/${id}`)
  return data
}

export async function crearCliente(datos: CrearClientePeticion): Promise<Cliente> {
  const { data } = await http.post<Cliente>('/clientes', datos)
  return data
}

export async function actualizarCliente(
  id: number,
  datos: ActualizarClientePeticion,
): Promise<Cliente> {
  const { data } = await http.patch<Cliente>(`/clientes/${id}`, datos)
  return data
}

// Borrado lógico (DELETE responde 200 con el cliente ya inactivo)
export async function desactivarCliente(id: number): Promise<Cliente> {
  const { data } = await http.delete<Cliente>(`/clientes/${id}`)
  return data
}
