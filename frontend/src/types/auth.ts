import type { FechaIso } from './api'

// Enum Rol del backend (prisma/schema.prisma)
export const ROLES = ['ADMIN', 'VENDEDOR', 'BODEGUERO', 'COMPRAS'] as const
export type Rol = (typeof ROLES)[number]

// UsuarioPublico del backend (sin passwordHash)
export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

// POST /api/auth/login
export interface LoginPeticion {
  email: string
  password: string
}

export interface LoginRespuesta {
  accessToken: string
  usuario: Usuario
}

// PATCH /api/auth/password (204)
export interface CambiarPasswordPeticion {
  passwordActual: string
  passwordNueva: string
}
