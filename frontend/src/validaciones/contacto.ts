import {
  DIRECCION_MAX,
  EMAIL_CONTACTO_MAX,
  NOMBRE_ENTIDAD_MAX,
  TELEFONO_MAX,
} from '@/types/contacto'
import { FORMATO_EMAIL, type Errores } from './comun'

// Campos comunes a clientes y proveedores. Todo como texto en el formulario:
// un opcional vacío se envía como null.

// Mismo patrón que el backend (IsTelefono)
const FORMATO_TELEFONO = /^\+?[0-9\s()-]{6,20}$/

export interface FormularioContacto {
  nit: string
  nombre: string
  email: string
  telefono: string
  direccion: string
}

// El formato del NIT (dígitos + verificador, o CF solo en clientes) lo valida
// el backend, que también lo normaliza; su 400 se muestra junto al campo.
export function validarContacto(f: FormularioContacto, mensajeNitVacio: string): Errores {
  const errores: Errores = {}
  if (f.nit.trim() === '') {
    errores.nit = mensajeNitVacio
  }
  const nombre = f.nombre.trim()
  if (nombre === '') {
    errores.nombre = 'Escribe el nombre'
  } else if (nombre.length > NOMBRE_ENTIDAD_MAX) {
    errores.nombre = `Máximo ${NOMBRE_ENTIDAD_MAX} caracteres`
  }
  const email = f.email.trim()
  if (email !== '' && !FORMATO_EMAIL.test(email)) {
    errores.email = 'Escribe un correo válido'
  } else if (email.length > EMAIL_CONTACTO_MAX) {
    errores.email = `Máximo ${EMAIL_CONTACTO_MAX} caracteres`
  }
  const telefono = f.telefono.trim()
  if (telefono !== '' && (!FORMATO_TELEFONO.test(telefono) || telefono.length > TELEFONO_MAX)) {
    errores.telefono = 'Solo dígitos, espacios, +, - y paréntesis (6 a 20)'
  }
  if (f.direccion.trim().length > DIRECCION_MAX) {
    errores.direccion = `Máximo ${DIRECCION_MAX} caracteres`
  }
  return errores
}

export const opcional = (valor: string): string | null => valor.trim() || null

// PATCH: solo los campos que cambiaron (el backend responde 400 a un body
// vacío). Vaciar un opcional envía null, que lo borra.
export function soloCambios<T extends Record<string, unknown>>(
  original: Record<string, unknown>,
  nuevo: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(nuevo).filter(([campo, valor]) => valor !== original[campo]),
  ) as Partial<T>
}
