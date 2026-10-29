import type { Rol } from '@/types/auth'
import { EMAIL_MAX, NOMBRE_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/types/usuarios'

// Validaciones en el cliente: lo mismo que valida el backend, para avisar
// antes de enviar. La respuesta del servidor sigue siendo la autoridad.
// Cada función devuelve { campo: mensaje }; vacío = sin errores.
export type Errores = Record<string, string>

// No es la regla completa de IsEmail: solo atrapa lo evidente
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarPasswordNueva(
  errores: Errores,
  campo: string,
  password: string,
  confirmacion: string,
  campoConfirmacion: string,
): void {
  if (password.length < PASSWORD_MIN) {
    errores[campo] = `Debe tener al menos ${PASSWORD_MIN} caracteres`
  } else if (password.length > PASSWORD_MAX) {
    errores[campo] = `Debe tener como máximo ${PASSWORD_MAX} caracteres`
  }
  if (confirmacion !== password) {
    errores[campoConfirmacion] = 'Las contraseñas no coinciden'
  }
}

// Perfil: cambio de la propia contraseña. Las contraseñas no se recortan
// (los espacios cuentan), igual que en el backend.
export interface FormularioCambioPassword {
  passwordActual: string
  passwordNueva: string
  confirmacion: string
}

export function validarCambioPassword(f: FormularioCambioPassword): Errores {
  const errores: Errores = {}
  if (f.passwordActual === '') {
    errores.passwordActual = 'Escribe tu contraseña actual'
  }
  validarPasswordNueva(errores, 'passwordNueva', f.passwordNueva, f.confirmacion, 'confirmacion')
  // Misma regla que el backend (auth.service: cambiarPassword)
  if (!errores.passwordNueva && f.passwordActual !== '' && f.passwordNueva === f.passwordActual) {
    errores.passwordNueva = 'Debe ser distinta de la actual'
  }
  return errores
}

// Usuarios (ADMIN): crear o editar. Al editar no hay email (no se cambia) ni
// contraseña (va por "restablecer").
export interface FormularioUsuario {
  nombre: string
  email: string
  rol: Rol | null
  password: string
  confirmacion: string
}

export function validarUsuario(f: FormularioUsuario, modo: 'crear' | 'editar'): Errores {
  const errores: Errores = {}
  const nombre = f.nombre.trim()
  if (nombre === '') {
    errores.nombre = 'Escribe el nombre'
  } else if (nombre.length > NOMBRE_MAX) {
    errores.nombre = `Máximo ${NOMBRE_MAX} caracteres`
  }
  if (f.rol === null) {
    errores.rol = 'Elige un rol'
  }
  if (modo === 'crear') {
    const email = f.email.trim()
    if (!FORMATO_EMAIL.test(email)) {
      errores.email = 'Escribe un correo válido'
    } else if (email.length > EMAIL_MAX) {
      errores.email = `Máximo ${EMAIL_MAX} caracteres`
    }
    validarPasswordNueva(errores, 'password', f.password, f.confirmacion, 'confirmacion')
  }
  return errores
}

// Usuarios (ADMIN): restablecer la contraseña de otro usuario
export function validarRestablecerPassword(password: string, confirmacion: string): Errores {
  const errores: Errores = {}
  validarPasswordNueva(errores, 'password', password, confirmacion, 'confirmacion')
  return errores
}

// Errores del servidor (traducirError().campos trae listas) al mismo formato
export function erroresDelServidor(campos: Record<string, string[]>): Errores {
  return Object.fromEntries(
    Object.entries(campos).map(([campo, mensajes]) => [campo, mensajes.join(' ')]),
  )
}
