import type { ParametrosPaginacion } from './api'
import type { Rol } from './auth'

// Mismos límites que el backend (src/modules/usuarios/dto/campos-usuario.ts),
// para avisar antes de enviar. La validación que manda es la del servidor.
export const NOMBRE_MAX = 100
export const EMAIL_MAX = 150
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

// GET /api/usuarios (ADMIN). El backend NO tiene ?buscar= ni ?rol=: la
// pantalla no filtra por texto ni por rol (decisión del 2026-10-28).
export interface ListarUsuariosParametros extends ParametrosPaginacion {
  // Por defecto solo activos
  incluirInactivos?: boolean
}

// POST /api/usuarios. El email se guarda recortado y en minúsculas.
// 409 "Registro duplicado: email" si ya existe.
export interface CrearUsuarioPeticion {
  nombre: string
  email: string
  password: string
  rol: Rol
}

// PATCH /api/usuarios/:id. El email no se puede cambiar. Body vacío → 400.
// 409 si un ADMIN se desactiva o se quita el rol a sí mismo, o si es el
// último admin activo.
export interface ActualizarUsuarioPeticion {
  nombre?: string
  rol?: Rol
  activo?: boolean
}

// PATCH /api/usuarios/:id/password (204)
export interface RestablecerPasswordPeticion {
  password: string
}
