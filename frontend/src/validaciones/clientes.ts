import type { ActualizarClientePeticion, Cliente, CrearClientePeticion } from '@/types/clientes'
import type { Errores } from './comun'
import { opcional, soloCambios, validarContacto, type FormularioContacto } from './contacto'

export type FormularioCliente = FormularioContacto

export function formularioDeCliente(cliente: Cliente | null): FormularioCliente {
  return {
    nit: cliente?.nit ?? '',
    nombre: cliente?.nombre ?? '',
    email: cliente?.email ?? '',
    telefono: cliente?.telefono ?? '',
    direccion: cliente?.direccion ?? '',
  }
}

export function validarCliente(f: FormularioCliente): Errores {
  return validarContacto(f, 'Escribe el NIT o usa "Consumidor final"')
}

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

// PATCH /api/clientes/:id: solo lo que cambió
export function cambiosDeCliente(
  original: Cliente,
  f: FormularioCliente,
): ActualizarClientePeticion {
  return soloCambios({ ...original }, { ...datosNuevoCliente(f) })
}
