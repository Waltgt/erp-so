import {
  DIRECCION_MAX,
  EMAIL_CLIENTE_MAX,
  NOMBRE_CLIENTE_MAX,
  TELEFONO_MAX,
  type ActualizarClientePeticion,
  type Cliente,
  type CrearClientePeticion,
} from '@/types/clientes'
import { FORMATO_EMAIL, type Errores } from './comun'

// Mismo patrón que el backend (IsTelefono)
const FORMATO_TELEFONO = /^\+?[0-9\s()-]{6,20}$/

// Todo como texto: un opcional vacío se envía como null
export interface FormularioCliente {
  nit: string
  nombre: string
  email: string
  telefono: string
  direccion: string
}

export function formularioDeCliente(cliente: Cliente | null): FormularioCliente {
  return {
    nit: cliente?.nit ?? '',
    nombre: cliente?.nombre ?? '',
    email: cliente?.email ?? '',
    telefono: cliente?.telefono ?? '',
    direccion: cliente?.direccion ?? '',
  }
}

// El formato del NIT (dígitos + verificador, o CF) lo valida el backend, que
// también lo normaliza; su 400 se muestra junto al campo.
export function validarCliente(f: FormularioCliente): Errores {
  const errores: Errores = {}
  if (f.nit.trim() === '') {
    errores.nit = 'Escribe el NIT o usa "Consumidor final"'
  }
  const nombre = f.nombre.trim()
  if (nombre === '') {
    errores.nombre = 'Escribe el nombre'
  } else if (nombre.length > NOMBRE_CLIENTE_MAX) {
    errores.nombre = `Máximo ${NOMBRE_CLIENTE_MAX} caracteres`
  }
  const email = f.email.trim()
  if (email !== '' && !FORMATO_EMAIL.test(email)) {
    errores.email = 'Escribe un correo válido'
  } else if (email.length > EMAIL_CLIENTE_MAX) {
    errores.email = `Máximo ${EMAIL_CLIENTE_MAX} caracteres`
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

const opcional = (valor: string): string | null => valor.trim() || null

// POST /api/clientes
export function datosNuevoCliente(f: FormularioCliente): CrearClientePeticion {
  return {
    nit: f.nit.trim(),
    nombre: f.nombre.trim(),
    email: opcional(f.email),
    telefono: opcional(f.telefono),
    direccion: opcional(f.direccion),
  }
}

// PATCH /api/clientes/:id: solo lo que cambió (el backend responde 400 a un
// body vacío). Vaciar un opcional envía null, que lo borra.
export function cambiosDeCliente(
  original: Cliente,
  f: FormularioCliente,
): ActualizarClientePeticion {
  const nuevo = datosNuevoCliente(f)
  const cambios: ActualizarClientePeticion = {}
  for (const campo of ['nit', 'nombre', 'email', 'telefono', 'direccion'] as const) {
    if (nuevo[campo] !== original[campo]) {
      Object.assign(cambios, { [campo]: nuevo[campo] })
    }
  }
  return cambios
}
