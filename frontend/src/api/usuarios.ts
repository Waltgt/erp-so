import type { Paginado } from '@/types/api'
import type { Usuario } from '@/types/auth'
import type {
  ActualizarUsuarioPeticion,
  CrearUsuarioPeticion,
  ListarUsuariosParametros,
  RestablecerPasswordPeticion,
} from '@/types/usuarios'
import { http } from './http'

// Todo /api/usuarios es solo para ADMIN (los demás roles reciben 403)

export async function listarUsuarios(
  parametros: ListarUsuariosParametros = {},
): Promise<Paginado<Usuario>> {
  const { data } = await http.get<Paginado<Usuario>>('/usuarios', { params: parametros })
  return data
}

export async function obtenerUsuario(id: number): Promise<Usuario> {
  const { data } = await http.get<Usuario>(`/usuarios/${id}`)
  return data
}

export async function crearUsuario(datos: CrearUsuarioPeticion): Promise<Usuario> {
  const { data } = await http.post<Usuario>('/usuarios', datos)
  return data
}

// Editar nombre o rol, y activar (activo: true) o desactivar (activo: false)
export async function actualizarUsuario(
  id: number,
  datos: ActualizarUsuarioPeticion,
): Promise<Usuario> {
  const { data } = await http.patch<Usuario>(`/usuarios/${id}`, datos)
  return data
}

// El ADMIN fija una contraseña nueva a otro usuario (no pide la actual)
export async function restablecerPassword(
  id: number,
  datos: RestablecerPasswordPeticion,
): Promise<void> {
  await http.patch(`/usuarios/${id}/password`, datos)
}
