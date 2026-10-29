// Validaciones en el cliente: lo mismo que valida el backend, para avisar
// antes de enviar. La respuesta del servidor sigue siendo la autoridad.
// Cada función devuelve { campo: mensaje }; vacío = sin errores.
export type Errores = Record<string, string>

// No es la regla completa de IsEmail: solo atrapa lo evidente
export const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Errores del servidor (traducirError().campos trae listas) al mismo formato
export function erroresDelServidor(campos: Record<string, string[]>): Errores {
  return Object.fromEntries(
    Object.entries(campos).map(([campo, mensajes]) => [campo, mensajes.join(' ')]),
  )
}
