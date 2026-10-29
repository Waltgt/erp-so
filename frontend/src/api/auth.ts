import type { CambiarPasswordPeticion, LoginPeticion, LoginRespuesta, Usuario } from '@/types/auth'
import { http } from './http'

// 401 = credenciales incorrectas (no es una sesión vencida); 429 = demasiados
// intentos
export async function login(datos: LoginPeticion): Promise<LoginRespuesta> {
  const { data } = await http.post<LoginRespuesta>('/auth/login', datos, {
    omitirSesionTerminada: true,
  })
  return data
}

// Al arrancar con una sesión guardada: confirma que el token sigue sirviendo
// y trae el usuario recién leído de la base (rol o estado pudieron cambiar)
export async function obtenerUsuarioActual(): Promise<Usuario> {
  const { data } = await http.get<Usuario>('/auth/me')
  return data
}

// 400 si la contraseña actual es incorrecta o la nueva no es válida
export async function cambiarPassword(datos: CambiarPasswordPeticion): Promise<void> {
  await http.patch('/auth/password', datos)
}
